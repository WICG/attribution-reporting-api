import * as psl from 'psl'
import * as constants from '../constants'
import { SourceType } from '../source-type'
import { VendorSpecificValues } from '../vendor-specific-values'
import * as context from './context'
import { Maybe, Maybeable } from './maybe'
import * as privacy from '../flexible-event/privacy'

const { None, some } = Maybe

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const UINT32_MAX: number = 2 ** 32 - 1

class Context extends context.Context {
  constructor(
    readonly vsv: Readonly<VendorSpecificValues>,
    readonly sourceType: SourceType,
    readonly parseFullFlex: boolean
  ) {
    super()
  }
}

type StructFields<T extends object> = {
  [K in keyof T]-?: CtxFunc<JsonDict, Maybe<T[K]>>
}

function struct<T extends object>(
  ctx: Context,
  d: Json,
  fields: StructFields<T>,
  warnUnknown: boolean = true
): Maybe<T> {
  return object(ctx, d).map((d) => {
    let t: Partial<T> = {}

    let ok = true
    for (const prop in fields) {
      let itemOk = false
      fields[prop](ctx, d).peek((v) => {
        itemOk = true
        t[prop] = v
      })
      ok = ok && itemOk
    }

    if (warnUnknown) {
      for (const key in d) {
        ctx.scope(key, () => ctx.warning('unknown field'))
      }
    }

    return ok ? some(t as T) : None
  })
}

type CtxFunc<I, O> = (ctx: Context, i: I) => O

function field<T>(
  name: string,
  f: CtxFunc<Json, Maybe<T>>,
  valueIfAbsent?: Maybeable<T>
): CtxFunc<JsonDict, Maybe<T>> {
  return (ctx: Context, d: JsonDict): Maybe<T> =>
    ctx.scope(name, () => {
      const v = d[name]
      if (v === undefined) {
        if (valueIfAbsent === undefined) {
          ctx.error('required')
          return None
        }
        return Maybe.flatten(valueIfAbsent)
      }
      delete d[name] // for unknown field warning
      return f(ctx, v)
    })
}

type Exclusive<T> = {
  [key: string]: CtxFunc<Json, Maybe<T>>
}

function exclusive<T>(
  x: Exclusive<T>,
  valueIfAbsent: Maybeable<T>
): CtxFunc<JsonDict, Maybe<T>> {
  return (ctx: Context, d: JsonDict): Maybe<T> => {
    const found: string[] = []
    let v: Maybe<T> = None

    for (const [key, f] of Object.entries(x)) {
      const j = d[key]
      if (j !== undefined) {
        found.push(key)
        v = ctx.scope(key, () => f(ctx, j))
        delete d[key] // for unknown field warning
      }
    }

    if (found.length === 1) {
      return v
    }

    if (found.length > 1) {
      ctx.error(`mutually exclusive fields: ${found.join(', ')}`)
      return None
    }

    return Maybe.flatten(valueIfAbsent)
  }
}

type TypeSwitch<T> = {
  null?: CtxFunc<null, Maybe<T>>
  boolean?: CtxFunc<boolean, Maybe<T>>
  number?: CtxFunc<number, Maybe<T>>
  string?: CtxFunc<string, Maybe<T>>
  list?: CtxFunc<Json[], Maybe<T>>
  object?: CtxFunc<JsonDict, Maybe<T>>
}

function typeSwitch<T>(ctx: Context, j: Json, ts: TypeSwitch<T>): Maybe<T> {
  if (j === null && ts.null !== undefined) {
    return ts.null(ctx, j)
  }
  if (typeof j === 'boolean' && ts.boolean !== undefined) {
    return ts.boolean(ctx, j)
  }
  if (typeof j === 'number' && ts.number !== undefined) {
    return ts.number(ctx, j)
  }
  if (typeof j === 'string' && ts.string !== undefined) {
    return ts.string(ctx, j)
  }
  if (Array.isArray(j) && ts.list !== undefined) {
    return ts.list(ctx, j)
  }
  if (isObject(j) && ts.object !== undefined) {
    return ts.object(ctx, j)
  }

  const allowed = Object.keys(ts)
    .map((t) => `${t === 'object' ? 'an' : t === 'null' ? '' : 'a'} ${t}`)
    .join(' or ')
  ctx.error(`must be ${allowed}`)
  return None
}

function string(ctx: Context, j: Json): Maybe<string> {
  return typeSwitch(ctx, j, { string: (_ctx, j) => some(j) })
}

function bool(ctx: Context, j: Json): Maybe<boolean> {
  return typeSwitch(ctx, j, { boolean: (_ctx, j) => some(j) })
}

function isObject(j: Json): j is JsonDict {
  return j !== null && typeof j === 'object' && j.constructor === Object
}

function object(ctx: Context, j: Json): Maybe<JsonDict> {
  return typeSwitch(ctx, j, { object: (_ctx, j) => some(j) })
}

function keyValues<V>(
  ctx: Context,
  j: Json,
  f: CtxFunc<[key: string, val: Json], Maybe<V>>,
  maxKeys: number = Infinity
): Maybe<Map<string, V>> {
  const map = new Map<string, V>()

  return object(ctx, j)
    .filter((d) => {
      const entries = Object.entries(d)

      if (entries.length > maxKeys) {
        ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
        return false
      }

      return isCollection(ctx, entries, (ctx, [key, j]) =>
        f(ctx, [key, j]).peek((v) => map.set(key, v))
      )
    })
    .map(() => map)
}

type ListOpts = {
  minLength?: number
  maxLength?: number
}

function list(
  ctx: Context,
  j: Json,
  { minLength = 0, maxLength = Infinity }: ListOpts = {}
): Maybe<Json[]> {
  return typeSwitch(ctx, j, { list: (_ctx, j) => some(j) }).filter((j) => {
    if (j.length > maxLength || j.length < minLength) {
      ctx.error(`length must be in the range [${minLength}, ${maxLength}]`)
      return false
    }
    return true
  })
}

function matchesPattern(
  ctx: Context,
  s: string,
  p: RegExp,
  errPrefix: string
): boolean {
  if (!p.test(s)) {
    ctx.error(`${errPrefix} (must match ${p})`)
    return false
  }
  return true
}

function uint64(ctx: Context, j: Json): Maybe<bigint> {
  return string(ctx, j)
    .filter((s) => matchesPattern(ctx, s, uint64Regex, 'must be a uint64'))
    .map(BigInt)
    .filter((n) =>
      isInRange(
        ctx,
        n,
        0n,
        2n ** 64n - 1n,
        'must fit in an unsigned 64-bit integer'
      )
    )
}

function triggerData(ctx: Context, j: Json): Maybe<bigint> {
  return uint64(ctx, j).peek((n) => {
    Object.entries(constants.defaultTriggerDataCardinality).forEach(
      ([t, c]) => {
        if (n >= c) {
          ctx.warning(
            `will be sanitized to ${
              n % c
            } if trigger is attributed to ${t} source`
          )
        }
      }
    )
  })
}

function number(ctx: Context, j: Json): Maybe<number> {
  return typeSwitch(ctx, j, { number: (_ctx, j) => some(j) })
}

function isInteger(ctx: Context, n: number): boolean {
  if (!Number.isInteger(n)) {
    ctx.error('must be an integer')
    return false
  }
  return true
}

function isInRange<N extends bigint | number>(
  ctx: Context,
  n: N,
  min: N,
  max: N,
  msg: string = `must be in the range [${min}, ${max}]`
): boolean {
  if (n < min || n > max) {
    ctx.error(msg)
    return false
  }
  return true
}

function nonNegativeInteger(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) => isInRange(ctx, n, 0, Infinity, 'must be non-negative'))
}

function positiveInteger(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) => isInRange(ctx, n, 1, Infinity, 'must be positive'))
}

function int64(ctx: Context, j: Json): Maybe<bigint> {
  return string(ctx, j)
    .filter((s) => matchesPattern(ctx, s, int64Regex, 'must be an int64'))
    .map(BigInt)
    .filter((n) =>
      isInRange(
        ctx,
        n,
        (-2n) ** (64n - 1n),
        2n ** (64n - 1n) - 1n,
        'must fit in a signed 64-bit integer'
      )
    )
}

function hex128(ctx: Context, j: Json): Maybe<bigint> {
  return string(ctx, j)
    .filter((s) => matchesPattern(ctx, s, hex128Regex, 'must be a hex128'))
    .map(BigInt)
}

function suitableScope(
  ctx: Context,
  s: string,
  label: string,
  scope: (url: URL) => string
): Maybe<string> {
  let url
  try {
    url = new URL(s)
  } catch {
    ctx.error('invalid URL')
    return None
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    ctx.error('URL must use HTTP/HTTPS and be potentially trustworthy')
    return None
  }

  const scoped = scope(url)
  if (s !== scoped) {
    ctx.warning(
      `URL components other than ${label} (${scoped}) will be ignored`
    )
  }
  return some(scoped)
}

function suitableOrigin(ctx: Context, j: Json): Maybe<string> {
  return string(ctx, j).map((s) =>
    suitableScope(ctx, s, 'origin', (u) => u.origin)
  )
}

function suitableSite(ctx: Context, j: Json): Maybe<string> {
  return string(ctx, j).map((s) =>
    suitableScope(
      ctx,
      s,
      'site',
      (u) => `${u.protocol}//${psl.get(u.hostname)}`
    )
  )
}

function destination(ctx: Context, j: Json): Maybe<Set<string>> {
  return typeSwitch(ctx, j, {
    string: (ctx, j) => suitableSite(ctx, j).map((s) => new Set([s])),
    list: (ctx, j) => set(ctx, j, suitableSite, { minLength: 1, maxLength: 3 }),
  })
}

function maxEventLevelReports(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) =>
      isInRange(ctx, n, 0, constants.maxSettableEventLevelAttributionsPerSource)
    )
}

function startTime(
  ctx: Context,
  j: Json,
  expiry: Maybe<number>
): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) => {
      if (expiry.value === undefined) {
        ctx.error('cannot be fully validated without a valid expiry')
        return false
      }
      return isInRange(
        ctx,
        n,
        0,
        expiry.value,
        `must be non-negative and <= expiry (${expiry.value})`
      )
    })
}

function endTimes(
  ctx: Context,
  j: Json,
  expiry: Maybe<number>,
  startTime: Maybe<number>
): Maybe<number[]> {
  if (startTime.value === undefined) {
    ctx.error('cannot be fully validated without a valid start_time')
    return None
  }

  if (expiry.value === undefined) {
    ctx.error('cannot be fully validated without a valid expiry')
    return None
  }

  let prev = startTime.value
  let prevDesc = 'start_time'

  const endTime = (ctx: Context, j: Json): Maybe<number> =>
    positiveInteger(ctx, j)
      .map((n) =>
        clamp(ctx, n, constants.minReportWindow, expiry.value!, ' (expiry)')
      )
      .filter((n) =>
        isInRange(ctx, n, prev + 1, Infinity, `must be > ${prevDesc} (${prev})`)
      )
      .peek((n) => {
        prev = n
        prevDesc = 'previous end_time'
      })

  return array(ctx, j, endTime, {
    minLength: 1,
    maxLength: 5,
    keepGoing: false, // suppress unhelpful cascaded errors
  })
}

export type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

function eventReportWindows(
  ctx: Context,
  j: Json,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return object(ctx, j).map((j) => {
    const startTimeValue = field(
      'start_time',
      (ctx, j) => startTime(ctx, j, expiry),
      0
    )(ctx, j)

    return struct(ctx, j, {
      startTime: () => startTimeValue,
      endTimes: field('end_times', (ctx, j) =>
        endTimes(ctx, j, expiry, startTimeValue)
      ),
    })
  })
}

function legacyDuration(ctx: Context, j: Json): Maybe<number | bigint> {
  return typeSwitch<number | bigint>(ctx, j, {
    number: nonNegativeInteger,
    string: uint64,
  })
}

function isCollection<C extends context.PathComponent>(
  ctx: Context,
  js: Iterable<[C, Json]>,
  f: CtxFunc<[C, Json], Maybe<unknown>>,
  keepGoing: boolean = true
): boolean {
  let ok = true
  for (const [c, j] of js) {
    let itemOk = false
    ctx.scope(c, () => f(ctx, [c, j]).peek(() => (itemOk = true)))
    if (!itemOk && !keepGoing) {
      return false
    }
    ok = ok && itemOk
  }
  return ok
}

type SetOpts = ListOpts & {
  requireDistinct?: boolean
}

function set<T extends number | string>(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, Maybe<T>>,
  opts?: SetOpts
): Maybe<Set<T>> {
  const set = new Set<T>()

  return list(ctx, j, opts)
    .filter((js) =>
      isCollection(ctx, js.entries(), (ctx, [_i, j]) =>
        f(ctx, j).filter((v) => {
          if (set.has(v)) {
            const msg = `duplicate value ${v}`
            if (opts?.requireDistinct) {
              ctx.error(msg)
              return false
            }
            ctx.warning(msg)
          } else {
            set.add(v)
          }
          return true
        })
      )
    )
    .map(() => set)
}

type ArrayOpts = ListOpts & {
  keepGoing?: boolean
}

function array<T>(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, Maybe<T>>,
  opts?: ArrayOpts
): Maybe<T[]> {
  const arr: T[] = []

  return list(ctx, j, opts)
    .filter((js) =>
      isCollection(
        ctx,
        js.entries(),
        (ctx, [_i, j]) => f(ctx, j).peek((v) => arr.push(v)),
        opts?.keepGoing
      )
    )
    .map(() => arr)
}

// TODO: Check length of strings.
function filterDataKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Maybe<Set<string>> {
  if (key === 'source_type' || key === '_lookback_window') {
    ctx.error('is prohibited because it is implicitly set')
    return None
  }
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return None
  }

  const filterStringLength = (s: string, errorPrefix: string = '') => {
    if (s.length > constants.maxLengthPerFilterString) {
      ctx.error(
        `${errorPrefix}exceeds max length per filter string (${s.length} > ${constants.maxLengthPerFilterString})`
      )
      return false
    }
    return true
  }

  if (!filterStringLength(key, 'key ')) {
    return None
  }

  return set(ctx, j, (ctx, j) => string(ctx, j).filter(filterStringLength), {
    maxLength: constants.maxValuesPerFilterDataEntry,
  })
}

export type FilterData = Map<string, Set<string>>

function filterData(ctx: Context, j: Json): Maybe<FilterData> {
  return keyValues(
    ctx,
    j,
    filterDataKeyValue,
    constants.maxEntriesPerFilterData
  )
}

function filterKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Maybe<Set<string>> {
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return None
  }

  const peek =
    key === 'source_type'
      ? (s: string) => {
          if (!(s in SourceType)) {
            const allowed = Object.keys(SourceType).join(', ')
            ctx.warning(
              `unknown value ${s} (${key} can only match one of ${allowed})`
            )
          }
        }
      : () => {}

  return set(ctx, j, (ctx, j) => string(ctx, j).peek(peek))
}

export type FilterConfig = {
  lookbackWindow: number | null
  map: Map<string, Set<string>>
}

function filterConfig(ctx: Context, j: Json): Maybe<FilterConfig> {
  // `lookbackWindow` must come before `map` to ensure it is processed first.
  return struct(
    ctx,
    j,
    {
      lookbackWindow: field('_lookback_window', positiveInteger, null),
      map: (ctx, j) => keyValues(ctx, j, filterKeyValue),
    },
    /*warnUnknown=*/ false
  )
}

function orFilters(ctx: Context, j: Json): Maybe<FilterConfig[]> {
  return typeSwitch(ctx, j, {
    list: (ctx, j) => array(ctx, j, filterConfig),
    object: (ctx, j) => filterConfig(ctx, j).map((v) => [v]),
  })
}

export type FilterPair = {
  positive: FilterConfig[]
  negative: FilterConfig[]
}

const filterFields: StructFields<FilterPair> = {
  positive: field('filters', orFilters, []),
  negative: field('not_filters', orFilters, []),
}

export type CommonDebug = {
  debugKey: bigint | null
  debugReporting: boolean
}

const commonDebugFields: StructFields<CommonDebug> = {
  debugKey: field('debug_key', uint64, null),
  debugReporting: field('debug_reporting', bool, false),
}

export type DedupKey = {
  dedupKey: bigint | null
}

const dedupKeyField: StructFields<DedupKey> = {
  dedupKey: field('deduplication_key', uint64, null),
}

export type Priority = {
  priority: bigint
}

const priorityField: StructFields<Priority> = {
  priority: field('priority', int64, 0n),
}

function aggregationKeyIdentifierLength(
  ctx: Context,
  s: string,
  errPrefix: string = ''
): boolean {
  if (s.length > constants.maxLengthPerAggregationKeyIdentifier) {
    ctx.error(
      `${errPrefix}exceeds max length per aggregation key identifier (${s.length} > ${constants.maxLengthPerAggregationKeyIdentifier})`
    )
    return false
  }
  return true
}

function aggregationKey(ctx: Context, [key, j]: [string, Json]): Maybe<bigint> {
  if (!aggregationKeyIdentifierLength(ctx, key, 'key ')) {
    return None
  }
  return hex128(ctx, j)
}

function aggregationKeys(ctx: Context, j: Json): Maybe<Map<string, bigint>> {
  return keyValues(
    ctx,
    j,
    aggregationKey,
    constants.maxAggregationKeysPerSource
  )
}

function clamp<N extends bigint | number>(
  ctx: Context,
  n: N,
  min: N,
  max: N,
  maxSuffix: string = ''
): N {
  if (n < min) {
    ctx.warning(`will be clamped to min of ${min}`)
    return min
  }
  if (n > max) {
    ctx.warning(`will be clamped to max of ${max}${maxSuffix}`)
    return max
  }
  return n
}

function roundAwayFromZeroToNearestDay(n: number): number {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError()
  }

  const r = n + constants.SECONDS_PER_DAY / 2
  return r - (r % constants.SECONDS_PER_DAY)
}

function expiry(ctx: Context, j: Json): Maybe<number> {
  return legacyDuration(ctx, j)
    .map((n) => clamp(ctx, n, ...constants.validSourceExpiryRange))
    .map(Number) // guaranteed to fit based on the clamping
    .map((n) => {
      switch (ctx.sourceType) {
        case SourceType.event:
          const r = roundAwayFromZeroToNearestDay(n)
          if (n !== r) {
            ctx.warning(
              `will be rounded to nearest day (${r}) as source type is event`
            )
          }
          return r
        case SourceType.navigation:
          return n
      }
    })
}

function singleReportWindow(
  ctx: Context,
  j: Json,
  expiry: Maybe<number>
): Maybe<number> {
  return legacyDuration(ctx, j)
    .map((n) => {
      if (expiry.value === undefined) {
        ctx.error('cannot be fully validated without a valid expiry')
        return None
      }
      return clamp(ctx, n, constants.minReportWindow, expiry.value, ' (expiry)')
    })
    .map(Number)
}

function defaultEventReportWindows(
  ctx: Context,
  end: number
): EventReportWindows {
  const endTimes = constants.defaultEarlyEventLevelReportWindows[
    ctx.sourceType
  ].filter((e) => e < end)
  endTimes.push(end)
  return { startTime: 0, endTimes }
}

function eventReportWindow(
  ctx: Context,
  j: Json,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return singleReportWindow(ctx, j, expiry).map((n) =>
    defaultEventReportWindows(ctx, n)
  )
}

function channelCapacity(ctx: Context, s: Source): void {
  const perTriggerDataConfigs = s.triggerSpecs.flatMap((spec) =>
    Array(spec.triggerData.size).fill(
      new privacy.PerTriggerDataConfig(
        spec.eventReportWindows.endTimes.length,
        spec.summaryBuckets.length
      )
    )
  )

  const config = new privacy.Config(
    s.maxEventLevelReports,
    perTriggerDataConfigs
  )

  const { infoGain } = config.computeConfigData(
    ctx.vsv.randomizedResponseEpsilon,
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  )

  const max = ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  if (infoGain > max) {
    ctx.error(
      `exceeds max event-level channel capacity per ${
        ctx.sourceType
      } source (${infoGain.toFixed(2)} > ${max.toFixed(2)})`
    )
  }
}

export enum SummaryWindowOperator {
  count = 'count',
  value_sum = 'value_sum',
}

export type TriggerSpec = {
  eventReportWindows: EventReportWindows
  summaryBuckets: number[]
  summaryWindowOperator: SummaryWindowOperator
  triggerData: Set<number>
}

function summaryBuckets(
  ctx: Context,
  j: Json,
  maxEventLevelReports: Maybe<number>
): Maybe<number[]> {
  let prev = 0
  let prevDesc = 'implicit minimum'

  const bucket = (ctx: Context, j: Json): Maybe<number> =>
    number(ctx, j)
      .filter((n) => isInteger(ctx, n))
      .filter((n) =>
        isInRange(
          ctx,
          n,
          prev + 1,
          UINT32_MAX,
          `must be > ${prevDesc} (${prev}) and <= uint32 max (${UINT32_MAX})`
        )
      )
      .peek((n) => {
        prev = n
        prevDesc = 'previous value'
      })

  return array(ctx, j, bucket, {
    minLength: 1,
    keepGoing: false, // suppress unhelpful cascaded errors
  }).peek((buckets) =>
    maxEventLevelReports.peek((n) => {
      if (buckets.length > n) {
        ctx.warning(
          `will be truncated to first ${n} buckets (max event-level reports)`
        )
      }
    })
  )
}

function fullFlexTriggerDatum(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) => isInRange(ctx, n, 0, UINT32_MAX))
}

function triggerDataSet(ctx: Context, j: Json): Maybe<Set<number>> {
  return set(ctx, j, fullFlexTriggerDatum, {
    minLength: 1,
    maxLength: constants.maxTriggerDataPerSource,
    requireDistinct: true,
  })
}

type TriggerSpecDeps = {
  expiry: Maybe<number>
  eventReportWindows: Maybe<EventReportWindows>
  maxEventLevelReports: Maybe<number>
}

function triggerSpec(
  ctx: Context,
  j: Json,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec> {
  const defaultSummaryBuckets = deps.maxEventLevelReports.map((n) =>
    Array.from({ length: n }, (_, i) => i + 1)
  )

  return struct(ctx, j, {
    eventReportWindows: field(
      'event_report_windows',
      (ctx, j) => eventReportWindows(ctx, j, deps.expiry),
      deps.eventReportWindows
    ),

    summaryBuckets: field(
      'summary_buckets',
      (ctx, j) => summaryBuckets(ctx, j, deps.maxEventLevelReports),
      defaultSummaryBuckets
    ),

    summaryWindowOperator: field(
      'summary_window_operator',
      (ctx, j) => enumerated(ctx, j, SummaryWindowOperator),
      SummaryWindowOperator.count
    ),

    triggerData: field('trigger_data', triggerDataSet),
  })
}

function triggerSpecs(
  ctx: Context,
  j: Json,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec[]> {
  return array(ctx, j, (ctx, j) => triggerSpec(ctx, j, deps), {
    maxLength: constants.maxTriggerDataPerSource,
  }).filter((specs) => {
    const triggerData = new Set<number>()
    const dups = new Set<number>()
    for (const spec of specs) {
      for (const triggerDatum of spec.triggerData) {
        if (triggerData.has(triggerDatum)) {
          dups.add(triggerDatum)
        } else {
          triggerData.add(triggerDatum)
        }
      }
    }

    let ok = true
    if (triggerData.size > constants.maxTriggerDataPerSource) {
      ctx.error(
        `exceeds maximum number of distinct trigger_data (${triggerData.size} > ${constants.maxTriggerDataPerSource})`
      )
      ok = false
    }

    if (dups.size > 0) {
      ctx.error(`duplicate trigger_data: ${Array.from(dups).join(', ')}`)
      ok = false
    }

    return ok
  })
}

function defaultTriggerSpecs(
  ctx: Context,
  eventReportWindows: Maybe<EventReportWindows>,
  maxEventLevelReports: Maybe<number>
): Maybe<TriggerSpec[]> {
  return eventReportWindows.map((eventReportWindows) =>
    maxEventLevelReports.map((maxEventLevelReports) => [
      {
        eventReportWindows,
        summaryBuckets: Array.from(
          { length: maxEventLevelReports },
          (_, i) => i + 1
        ),
        summaryWindowOperator: SummaryWindowOperator.count,
        triggerData: new Set(
          Array.from(
            {
              length: Number(
                constants.defaultTriggerDataCardinality[ctx.sourceType]
              ),
            },
            (_, i) => i
          )
        ),
      },
    ])
  )
}

export enum TriggerDataMatching {
  exact = 'exact',
  modulus = 'modulus',
}

function triggerDataMatching(
  ctx: Context,
  j: Json,
  specs: Maybe<TriggerSpec[]>
): Maybe<TriggerDataMatching> {
  return enumerated(ctx, j, TriggerDataMatching).filter((v) => {
    if (v !== TriggerDataMatching.modulus) {
      return true
    }

    if (specs.value === undefined) {
      ctx.error('cannot be fully validated without valid trigger specs')
      return false
    }

    const triggerData: number[] = specs.value
      .flatMap((spec) => Array.from(spec.triggerData))
      .sort()

    if (triggerData.some((triggerDatum, i) => triggerDatum !== i)) {
      ctx.error(
        'trigger_data must form a contiguous sequence of integers starting at 0 for modulus'
      )
      return false
    }

    return true
  })
}

export type Source = CommonDebug &
  Priority & {
    aggregatableReportWindow: number
    aggregationKeys: Map<string, bigint>
    destination: Set<string>
    eventReportWindows: EventReportWindows
    expiry: number
    filterData: FilterData
    maxEventLevelReports: number
    sourceEventId: bigint

    triggerSpecs: TriggerSpec[]
    triggerDataMatching: TriggerDataMatching
  }

function source(ctx: Context, j: Json): Maybe<Source> {
  return object(ctx, j)
    .map((j) => {
      const expiryVal = field(
        'expiry',
        expiry,
        constants.validSourceExpiryRange[1]
      )(ctx, j)

      const eventReportWindowsVal = exclusive(
        {
          event_report_window: (ctx, j) => eventReportWindow(ctx, j, expiryVal),
          event_report_windows: (ctx, j) =>
            eventReportWindows(ctx, j, expiryVal),
        },
        expiryVal.map((n) => defaultEventReportWindows(ctx, n))
      )(ctx, j)

      const maxEventLevelReportsVal = field(
        'max_event_level_reports',
        maxEventLevelReports,
        constants.defaultEventLevelAttributionsPerSource[ctx.sourceType]
      )(ctx, j)

      const defaultTriggerSpecsVal = defaultTriggerSpecs(
        ctx,
        eventReportWindowsVal,
        maxEventLevelReportsVal
      )

      const triggerSpecsVal = ctx.parseFullFlex
        ? field(
            'trigger_specs',
            (ctx, j) =>
              triggerSpecs(ctx, j, {
                expiry: expiryVal,
                eventReportWindows: eventReportWindowsVal,
                maxEventLevelReports: maxEventLevelReportsVal,
              }),
            defaultTriggerSpecsVal
          )(ctx, j)
        : defaultTriggerSpecsVal

      return struct(ctx, j, {
        aggregatableReportWindow: field(
          'aggregatable_report_window',
          (ctx, j) => singleReportWindow(ctx, j, expiryVal),
          expiryVal
        ),
        aggregationKeys: field('aggregation_keys', aggregationKeys, new Map()),
        destination: field('destination', destination),
        eventReportWindows: () => eventReportWindowsVal,
        expiry: () => expiryVal,
        filterData: field('filter_data', filterData, new Map()),
        maxEventLevelReports: () => maxEventLevelReportsVal,
        sourceEventId: field('source_event_id', uint64, 0n),
        triggerSpecs: () => triggerSpecsVal,

        triggerDataMatching: ctx.parseFullFlex
          ? field(
              'trigger_data_matching',
              (ctx, j) => triggerDataMatching(ctx, j, triggerSpecsVal),
              TriggerDataMatching.modulus
            )
          : () => some(TriggerDataMatching.modulus),

        ...commonDebugFields,
        ...priorityField,
      })
    })
    .peek((s) => channelCapacity(ctx, s))
}

function sourceKeys(ctx: Context, j: Json): Maybe<Set<string>> {
  return set(ctx, j, (ctx, j) =>
    string(ctx, j).filter((s) => aggregationKeyIdentifierLength(ctx, s))
  )
}

export type AggregatableTriggerDatum = FilterPair & {
  keyPiece: bigint
  sourceKeys: Set<string>
}

function aggregatableTriggerData(
  ctx: Context,
  j: Json
): Maybe<AggregatableTriggerDatum[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      keyPiece: field('key_piece', hex128),
      sourceKeys: field('source_keys', sourceKeys, new Set<string>()),
      ...filterFields,
    })
  )
}

// TODO: check length of key
function aggregatableKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Maybe<number> {
  if (!aggregationKeyIdentifierLength(ctx, key, 'key ')) {
    return None
  }
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) =>
      isInRange(ctx, n, 1, constants.allowedAggregatableBudgetPerSource)
    )
}

function aggregatableValues(ctx: Context, j: Json): Maybe<Map<string, number>> {
  return keyValues(ctx, j, aggregatableKeyValue)
}

export type EventTriggerDatum = FilterPair &
  Priority &
  DedupKey & {
    triggerData: bigint
    value: number
  }

function eventTriggerData(ctx: Context, j: Json): Maybe<EventTriggerDatum[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      triggerData: field('trigger_data', triggerData, 0n),

      value: ctx.parseFullFlex
        ? field('value', positiveInteger, 1)
        : () => some(1),

      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

export type AggregatableDedupKey = FilterPair & DedupKey

function aggregatableDedupKeys(
  ctx: Context,
  j: Json
): Maybe<AggregatableDedupKey[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      ...dedupKeyField,
      ...filterFields,
    })
  )
}

function enumerated<T>(ctx: Context, j: Json, e: Record<string, T>): Maybe<T> {
  return string(ctx, j).map((s) => {
    const v = e[s]
    if (v !== undefined) {
      return v
    }
    const allowed = Object.keys(e).join(', ')
    ctx.error(`must be one of the following (case-sensitive): ${allowed}`)
    return None
  })
}

export enum AggregatableSourceRegistrationTime {
  exclude = 'exclude',
  include = 'include',
}

function aggregatableSourceRegistrationTime(
  ctx: Context,
  j: Json
): Maybe<AggregatableSourceRegistrationTime> {
  return enumerated(ctx, j, AggregatableSourceRegistrationTime)
}

export type Trigger = CommonDebug &
  FilterPair & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: AggregatableSourceRegistrationTime
    aggregatableValues: Map<string, number>
    aggregationCoordinatorOrigin: string | null
    eventTriggerData: EventTriggerDatum[]
  }

function trigger(ctx: Context, j: Json): Maybe<Trigger> {
  return struct(ctx, j, {
    aggregatableTriggerData: field(
      'aggregatable_trigger_data',
      aggregatableTriggerData,
      []
    ),
    aggregatableValues: field(
      'aggregatable_values',
      aggregatableValues,
      new Map()
    ),
    aggregatableDedupKeys: field(
      'aggregatable_deduplication_keys',
      aggregatableDedupKeys,
      []
    ),
    aggregatableSourceRegistrationTime: field(
      'aggregatable_source_registration_time',
      aggregatableSourceRegistrationTime,
      AggregatableSourceRegistrationTime.exclude
    ),
    aggregationCoordinatorOrigin: field(
      'aggregation_coordinator_origin',
      suitableOrigin,
      null
    ),
    eventTriggerData: field('event_trigger_data', eventTriggerData, []),
    ...commonDebugFields,
    ...filterFields,
  })
}

function validateJSON<T>(
  json: string,
  f: CtxFunc<Json, Maybe<T>>,
  vsv: Readonly<VendorSpecificValues>,
  sourceType: SourceType, // irrelevant for triggers
  parseFullFlex: boolean
): [context.ValidationResult, Maybe<T>] {
  const ctx = new Context(vsv, sourceType, parseFullFlex)

  let value
  try {
    value = JSON.parse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), None]
  }

  const v = f(ctx, value)
  return [ctx.finish(), v]
}

export function validateSource(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  sourceType: SourceType,
  parseFullFlex: boolean = false
): [context.ValidationResult, Maybe<Source>] {
  return validateJSON(json, source, vsv, sourceType, parseFullFlex)
}

export function validateTrigger(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  parseFullFlex: boolean = false
): [context.ValidationResult, Maybe<Trigger>] {
  return validateJSON(json, trigger, vsv, SourceType.navigation, parseFullFlex)
}
