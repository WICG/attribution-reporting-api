import * as psl from 'psl'
import * as uuid from 'uuid'
import * as constants from '../constants'
import { SourceType } from '../source-type'
import { VendorSpecificValues } from '../vendor-specific-values'
import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  CtxFunc,
  ItemErrorAction,
  clamp,
  isInteger,
  isInRange,
  matchesPattern,
} from './validate'
import * as validate from './validate'
import * as privacy from '../flexible-event/privacy'

const { None, some } = Maybe

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uintRegex = /^[0-9]+$/
const intRegex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const UINT32_MAX: number = 2 ** 32 - 1

class GenericContext extends Context {
  constructor(readonly parseFullFlex: boolean) {
    super()
  }
}

class RegistrationContext extends GenericContext {
  constructor(
    readonly vsv: Readonly<VendorSpecificValues>,
    parseFullFlex: boolean,
    readonly aggregatableDebugTypes: Readonly<[string, ...string[]]>
  ) {
    super(parseFullFlex)
  }

  isDebugTypeSupported(s: string): boolean {
    return this.aggregatableDebugTypes.includes(s)
  }
}

class SourceContext extends RegistrationContext {
  constructor(
    vsv: VendorSpecificValues,
    parseFullFlex: boolean,
    readonly sourceType: SourceType,
    readonly noteInfoGain: boolean
  ) {
    super(vsv, parseFullFlex, constants.sourceAggregatableDebugTypes)
  }
}

const {
  exclusive,
  field,
  struct: structInternal,
} = validate.make<JsonDict, Json>(
  /*getAndDelete=*/ (d, name) => {
    const v = d[name]
    delete d[name]
    return v
  },
  /*unknownKeys=*/ (d) => Object.keys(d),
  /*warnUnknownMsg=*/ 'unknown field'
)

type StructFields<
  T extends object,
  C extends Context = Context,
> = validate.StructFields<T, JsonDict, C>

function struct<T extends object, C extends Context>(
  ctx: C,
  d: Json,
  fields: StructFields<T, C>,
  warnUnknown: boolean = true
): Maybe<T> {
  return object(ctx, d).map((d) => structInternal(ctx, d, fields, warnUnknown))
}

type TypeSwitch<T, C extends Context = Context> = {
  boolean?: CtxFunc<C, boolean, Maybe<T>>
  number?: CtxFunc<C, number, Maybe<T>>
  string?: CtxFunc<C, string, Maybe<T>>
  list?: CtxFunc<C, Json[], Maybe<T>>
  object?: CtxFunc<C, JsonDict, Maybe<T>>
}

function typeSwitch<T, C extends Context = Context>(
  ctx: C,
  j: Json,
  ts: TypeSwitch<T, C>
): Maybe<T> {
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
    .map((t) => `${t === 'object' ? 'an' : 'a'} ${t}`)
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

function keyValues<V, C extends Context = Context>(
  ctx: C,
  j: Json,
  f: CtxFunc<C, [key: string, val: Json], Maybe<V>>,
  maxKeys: number = Infinity
): Maybe<Map<string, V>> {
  return object(ctx, j).map((d) => {
    const entries = Object.entries(d)

    if (entries.length > maxKeys) {
      ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
      return None
    }

    return validate.keyValues(ctx, entries, f)
  })
}

type LengthOpts = {
  minLength?: number
  maxLength?: number
  maxLengthErrSuffix?: string
}

function list(ctx: Context, j: Json): Maybe<Json[]> {
  return typeSwitch(ctx, j, { list: (_ctx, j) => some(j) })
}

function isLengthValid(
  ctx: Context,
  length: number,
  {
    minLength = 0,
    maxLength = Infinity,
    maxLengthErrSuffix = '',
  }: LengthOpts = {}
): boolean {
  if (length > maxLength || length < minLength) {
    ctx.error(
      `length must be in the range [${minLength}, ${maxLength}${maxLengthErrSuffix}]`
    )
    return false
  }
  return true
}

function uint64(ctx: Context, j: Json): Maybe<bigint> {
  return string(ctx, j)
    .filter((s) =>
      matchesPattern(
        ctx,
        s,
        uintRegex,
        'string must represent a non-negative integer'
      )
    )
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

function number(ctx: Context, j: Json): Maybe<number> {
  return typeSwitch(ctx, j, { number: (_ctx, j) => some(j) })
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
    .filter((s) =>
      matchesPattern(ctx, s, intRegex, 'string must represent an integer')
    )
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
  scope: (url: URL) => string,
  rejectExtraComponents: boolean
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
  if (url.toString() !== new URL(scoped).toString()) {
    if (rejectExtraComponents) {
      ctx.error(
        `must not contain URL components other than ${label} (${scoped})`
      )
      return None
    }
    ctx.warning(
      `URL components other than ${label} (${scoped}) will be ignored`
    )
  }
  return some(scoped)
}

function suitableOrigin(
  ctx: Context,
  j: Json,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return string(ctx, j).map((s) =>
    suitableScope(ctx, s, 'origin', (u) => u.origin, rejectExtraComponents)
  )
}

function suitableSite(
  ctx: Context,
  j: Json,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return string(ctx, j).map((s) =>
    suitableScope(
      ctx,
      s,
      'site',
      (u) => `${u.protocol}//${psl.get(u.hostname)}`,
      rejectExtraComponents
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
    itemErrorAction: ItemErrorAction.earlyExit, // suppress unhelpful cascaded errors
  })
}

export type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

function eventReportWindows(
  ctx: SourceContext,
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

type SetOpts = LengthOpts & {
  requireDistinct?: boolean
}

function set<T extends number | string, C extends Context = Context>(
  ctx: C,
  j: Json,
  f: CtxFunc<C, Json, Maybe<T>>,
  opts?: SetOpts
): Maybe<Set<T>> {
  // TODO(https://github.com/WICG/attribution-reporting-api/issues/1321): Size
  // checks should be performed on the resulting set, not on the list.
  return list(ctx, j)
    .filter((js) => isLengthValid(ctx, js.length, opts))
    .map((js) => validate.set(ctx, js.entries(), f, opts?.requireDistinct))
}

type ArrayOpts = LengthOpts & {
  itemErrorAction?: ItemErrorAction
}

function array<T, C extends Context = Context>(
  ctx: C,
  j: Json,
  f: CtxFunc<C, Json, Maybe<T>>,
  opts?: ArrayOpts
): Maybe<T[]> {
  return list(ctx, j)
    .filter((js) => isLengthValid(ctx, js.length, opts))
    .map((js) => validate.array(ctx, js.entries(), f, opts?.itemErrorAction))
}

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

export function filterData(ctx: Context, j: Json): Maybe<FilterData> {
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

export function filterPair(ctx: Context, j: Json): Maybe<FilterPair> {
  return struct(ctx, j, filterFields)
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

function aggregatableDebugType(
  ctx: RegistrationContext,
  j: Json
): Maybe<string> {
  return string(ctx, j).peek((s) => {
    if (!ctx.isDebugTypeSupported(s)) {
      ctx.warning('unknown type')
    }
  })
}

export type KeyPiece = {
  keyPiece: bigint
}

const keyPieceField: StructFields<KeyPiece> = {
  keyPiece: field('key_piece', hex128),
}

export type AggregatableDebugReportingData = KeyPiece & {
  types: Set<string>
  value: number
}

function aggregatableDebugReportingData(
  ctx: RegistrationContext,
  j: Json
): Maybe<AggregatableDebugReportingData> {
  return struct(ctx, j, {
    types: field('types', (ctx, j) =>
      set(ctx, j, aggregatableDebugType, {
        minLength: 1,
        requireDistinct: true,
      })
    ),
    value: field('value', aggregatableValue),

    ...keyPieceField,
  })
}

function aggregatableDebugReportingDataList(
  ctx: RegistrationContext,
  j: Json
): Maybe<AggregatableDebugReportingData[]> {
  return array(ctx, j, aggregatableDebugReportingData).filter((data) => {
    const types = new Set<string>()
    const dups = new Set<string>()
    for (const d of data) {
      for (const t of d.types) {
        if (types.has(t)) {
          dups.add(t)
        } else {
          types.add(t)
        }
      }
    }
    if (dups.size > 0) {
      ctx.error(`duplicate type: ${Array.from(dups).join(', ')}`)
      return false
    }
    return true
  })
}

// Consider making this a StructFields.
function aggregationCoordinatorOriginField(
  ctx: RegistrationContext,
  j: JsonDict
): Maybe<string> {
  return field(
    'aggregation_coordinator_origin',
    aggregationCoordinatorOrigin,
    ctx.vsv.aggregationCoordinatorOrigins[0]
  )(ctx, j)
}

export type AggregatableDebugReportingConfig = KeyPiece & {
  aggregationCoordinatorOrigin: string
  debugData: AggregatableDebugReportingData[]
}

const aggregatableDebugReportingConfig: StructFields<
  AggregatableDebugReportingConfig,
  RegistrationContext
> = {
  aggregationCoordinatorOrigin: aggregationCoordinatorOriginField,
  debugData: field('debug_data', aggregatableDebugReportingDataList, []),

  ...keyPieceField,
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

function aggregationKeys(ctx: Context, j: Json): Maybe<AggregationKeys> {
  return keyValues(
    ctx,
    j,
    aggregationKey,
    constants.maxAggregationKeysPerSource
  )
}

function roundAwayFromZeroToNearestDay(n: number): number {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError()
  }

  const r = n + constants.SECONDS_PER_DAY / 2
  return r - (r % constants.SECONDS_PER_DAY)
}

function expiry(ctx: SourceContext, j: Json): Maybe<number> {
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
  ctx: SourceContext,
  end: number
): EventReportWindows {
  const endTimes = constants.defaultEarlyEventLevelReportWindows[
    ctx.sourceType
  ].filter((e) => e < end)
  endTimes.push(end)
  return { startTime: 0, endTimes }
}

function eventReportWindow(
  ctx: SourceContext,
  j: Json,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return singleReportWindow(ctx, j, expiry).map((n) =>
    defaultEventReportWindows(ctx, n)
  )
}

function eventLevelEpsilon(ctx: RegistrationContext, j: Json): Maybe<number> {
  return number(ctx, j).filter((n) =>
    isInRange(ctx, n, 0, ctx.vsv.maxSettableEventLevelEpsilon)
  )
}

function channelCapacity(ctx: SourceContext, s: Source): void {
  const numStatesWords = 'number of possible output states'

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

  const out = config.computeConfigData(
    s.eventLevelEpsilon,
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  )

  const maxTriggerStates = ctx.vsv.maxTriggerStateCardinality

  if (out.numStates > maxTriggerStates) {
    ctx.error(
      `${numStatesWords} (${out.numStates}) exceeds max cardinality (${maxTriggerStates})`
    )
  }

  const maxInfoGain =
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  const infoGainMsg = `information gain: ${out.infoGain.toFixed(2)}`

  if (out.infoGain > maxInfoGain) {
    ctx.error(
      `${infoGainMsg} exceeds max event-level channel capacity per ${
        ctx.sourceType
      } source (${maxInfoGain.toFixed(2)})`
    )
  } else if (ctx.noteInfoGain) {
    ctx.note(infoGainMsg)
  }

  if (ctx.noteInfoGain) {
    ctx.note(`${numStatesWords}: ${out.numStates}`)
    ctx.note(`randomized trigger rate: ${out.flipProb.toFixed(7)}`)
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

export type SourceAggregatableDebugReportingConfig =
  AggregatableDebugReportingConfig & {
    budget: number
  }

function sourceAggregatableDebugReportingConfig(
  ctx: RegistrationContext,
  j: Json
): Maybe<SourceAggregatableDebugReportingConfig> {
  return struct(ctx, j, {
    budget: field('budget', aggregatableValue),

    ...aggregatableDebugReportingConfig,
  }).filter((s) => {
    for (const d of s.debugData) {
      if (d.value > s.budget) {
        // TODO: Consider passing the parsed budget to validate the debug data and
        // give more precise path information.
        ctx.error(`data contains value greater than budget (${s.budget})`)
        return false
      }
    }
    return true
  })
}

function summaryBuckets(
  ctx: Context,
  j: Json,
  maxEventLevelReports: Maybe<number>
): Maybe<number[]> {
  let maxLength
  if (maxEventLevelReports.value === undefined) {
    ctx.error(
      'cannot be fully validated without a valid max_event_level_reports'
    )
    maxLength = constants.maxSettableEventLevelAttributionsPerSource
  } else {
    maxLength = maxEventLevelReports.value
  }

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
    maxLength,
    maxLengthErrSuffix: ' (max_event_level_reports)',
    itemErrorAction: ItemErrorAction.earlyExit, // suppress unhelpful cascaded errors
  })
}

function fullFlexTriggerDatum(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) => isInRange(ctx, n, 0, UINT32_MAX))
}

function triggerDataSet(
  ctx: Context,
  j: Json,
  allowEmpty: boolean = false
): Maybe<Set<number>> {
  return set(ctx, j, fullFlexTriggerDatum, {
    minLength: allowEmpty ? 0 : 1,
    maxLength: constants.maxTriggerDataPerSource,
    requireDistinct: true,
  })
}

type TriggerSpecDeps = {
  expiry: Maybe<number>
  eventReportWindows: Maybe<EventReportWindows>
  maxEventLevelReports: Maybe<number>
}

function makeDefaultSummaryBuckets(maxEventLevelReports: number): number[] {
  return Array.from({ length: maxEventLevelReports }, (_, i) => i + 1)
}

function triggerSpec(
  ctx: SourceContext,
  j: Json,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec> {
  const defaultSummaryBuckets = deps.maxEventLevelReports.map(
    makeDefaultSummaryBuckets
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
  ctx: SourceContext,
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

function triggerSpecsFromTriggerData(
  ctx: Context,
  j: Json,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec[]> {
  return triggerDataSet(ctx, j, /*allowEmpty=*/ true).map((triggerData) => {
    if (
      triggerData.size === 0 ||
      deps.eventReportWindows.value === undefined ||
      deps.maxEventLevelReports.value === undefined
    ) {
      return []
    }

    return [
      {
        eventReportWindows: deps.eventReportWindows.value,
        summaryBuckets: makeDefaultSummaryBuckets(
          deps.maxEventLevelReports.value
        ),
        summaryWindowOperator: SummaryWindowOperator.count,
        triggerData: triggerData,
      },
    ]
  })
}

function defaultTriggerSpecs(
  ctx: SourceContext,
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
  j: Json
): Maybe<TriggerDataMatching> {
  return enumerated(ctx, j, TriggerDataMatching)
}

function isTriggerDataMatchingValidForSpecs(ctx: Context, s: Source): boolean {
  return ctx.scope('trigger_data_matching', () => {
    if (s.triggerDataMatching !== TriggerDataMatching.modulus) {
      return true
    }

    const triggerData: number[] = s.triggerSpecs
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

function warnInconsistentMaxEventLevelReportsAndTriggerSpecs(
  ctx: Context,
  s: Source
): void {
  const allowsReports = s.maxEventLevelReports > 0
  const hasSpecs = s.triggerSpecs.length > 0

  if (allowsReports && !hasSpecs) {
    ctx.warning(
      'max_event_level_reports > 0 but event-level attribution will always fail because trigger_specs is empty'
    )
  } else if (hasSpecs && !allowsReports) {
    ctx.warning(
      'trigger_specs non-empty but event-level attribution will always fail because max_event_level_reports = 0'
    )
  }
}

export type AggregationKeys = Map<string, bigint>

export type Source = CommonDebug &
  Priority & {
    aggregatableReportWindow: number
    aggregationKeys: AggregationKeys
    destination: Set<string>
    expiry: number
    filterData: FilterData
    maxEventLevelReports: number
    sourceEventId: bigint

    triggerSpecs: TriggerSpec[]
    triggerDataMatching: TriggerDataMatching

    eventLevelEpsilon: number
    aggregatableDebugReporting: SourceAggregatableDebugReportingConfig | null
  }

function source(ctx: SourceContext, j: Json): Maybe<Source> {
  return object(ctx, j)
    .map((j) => {
      const expiryVal = field(
        'expiry',
        expiry,
        constants.validSourceExpiryRange[1]
      )(ctx, j)

      const eventReportWindowsVal = exclusive(
        {
          event_report_window: (ctx: SourceContext, j) =>
            eventReportWindow(ctx, j, expiryVal),
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

      const triggerSpecsDeps = {
        expiry: expiryVal,
        eventReportWindows: eventReportWindowsVal,
        maxEventLevelReports: maxEventLevelReportsVal,
      }

      const triggerSpecsVal = exclusive(
        {
          trigger_data: (ctx, j) =>
            triggerSpecsFromTriggerData(ctx, j, triggerSpecsDeps),
          ...(ctx.parseFullFlex
            ? {
                trigger_specs: (ctx: SourceContext, j) =>
                  triggerSpecs(ctx, j, triggerSpecsDeps),
              }
            : {}),
        },
        defaultTriggerSpecsVal
      )(ctx, j)

      return struct(ctx, j, {
        aggregatableReportWindow: field(
          'aggregatable_report_window',
          (ctx, j) => singleReportWindow(ctx, j, expiryVal),
          expiryVal
        ),
        aggregationKeys: field('aggregation_keys', aggregationKeys, new Map()),
        destination: field('destination', destination),
        eventLevelEpsilon: field(
          'event_level_epsilon',
          eventLevelEpsilon,
          ctx.vsv.maxSettableEventLevelEpsilon
        ),
        expiry: () => expiryVal,
        filterData: field('filter_data', filterData, new Map()),
        maxEventLevelReports: () => maxEventLevelReportsVal,
        sourceEventId: field('source_event_id', uint64, 0n),
        triggerSpecs: () => triggerSpecsVal,
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          sourceAggregatableDebugReportingConfig,
          null
        ),

        triggerDataMatching: field(
          'trigger_data_matching',
          triggerDataMatching,
          TriggerDataMatching.modulus
        ),

        ...commonDebugFields,
        ...priorityField,
      })
    })
    .filter((s) => isTriggerDataMatchingValidForSpecs(ctx, s))
    .peek((s) => channelCapacity(ctx, s))
    .peek((s) => warnInconsistentMaxEventLevelReportsAndTriggerSpecs(ctx, s))
}

function sourceKeys(ctx: Context, j: Json): Maybe<Set<string>> {
  return set(ctx, j, (ctx, j) =>
    string(ctx, j).filter((s) => aggregationKeyIdentifierLength(ctx, s))
  )
}

export type AggregatableTriggerDatum = FilterPair &
  KeyPiece & {
    sourceKeys: Set<string>
  }

function aggregatableTriggerData(
  ctx: RegistrationContext,
  j: Json
): Maybe<AggregatableTriggerDatum[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      sourceKeys: field('source_keys', sourceKeys, new Set<string>()),
      ...filterFields,
      ...keyPieceField,
    })
  )
}

export type AggregatableValues = Map<string, number>

export type AggregatableValuesConfiguration = FilterPair & {
  values: AggregatableValues
}

function aggregatableValue(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) =>
      isInRange(ctx, n, 1, constants.allowedAggregatableBudgetPerSource)
    )
}

function aggregatableKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Maybe<number> {
  if (!aggregationKeyIdentifierLength(ctx, key, 'key ')) {
    return None
  }
  return aggregatableValue(ctx, j)
}

function aggregatableKeyValues(
  ctx: Context,
  j: Json
): Maybe<AggregatableValues> {
  return keyValues(ctx, j, aggregatableKeyValue)
}

function aggregatableValuesConfigurations(
  ctx: Context,
  j: Json
): Maybe<AggregatableValuesConfiguration[]> {
  return typeSwitch(ctx, j, {
    object: (ctx, j) =>
      aggregatableKeyValues(ctx, j).map((values) => [
        { values, positive: [], negative: [] },
      ]),
    list: (ctx, j) =>
      array(ctx, j, (ctx, j) =>
        struct(ctx, j, {
          values: field('values', aggregatableKeyValues),
          ...filterFields,
        })
      ),
  })
}

export type EventTriggerDatum = FilterPair &
  Priority &
  DedupKey & {
    triggerData: bigint
    value: number
  }

function eventTriggerValue(ctx: RegistrationContext, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => isInteger(ctx, n))
    .filter((n) =>
      isInRange(
        ctx,
        n,
        1,
        UINT32_MAX,
        `must be >= 1 and <= uint32 max (${UINT32_MAX})`
      )
    )
}

function eventTriggerData(
  ctx: RegistrationContext,
  j: Json
): Maybe<EventTriggerDatum[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      triggerData: field('trigger_data', uint64, 0n),

      value: ctx.parseFullFlex
        ? field('value', eventTriggerValue, 1)
        : () => some(1),

      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

export type AggregatableDedupKey = FilterPair & DedupKey

function aggregatableDedupKeys(
  ctx: RegistrationContext,
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
  return string(ctx, j).map((s) => validate.enumerated(ctx, s, e))
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

function warnInconsistentAggregatableKeys(ctx: Context, t: Trigger): void {
  const allAggregatableValueKeys = new Set<string>()
  for (const cfg of t.aggregatableValuesConfigurations) {
    for (const key of cfg.values.keys()) {
      allAggregatableValueKeys.add(key)
    }
  }

  const triggerDataKeys = new Set<string>()

  ctx.scope('aggregatable_trigger_data', () => {
    for (const [index, datum] of t.aggregatableTriggerData.entries()) {
      ctx.scope(index, () => {
        for (const key of datum.sourceKeys) {
          triggerDataKeys.add(key)

          if (!allAggregatableValueKeys.has(key)) {
            ctx.scope('source_keys', () =>
              ctx.warning(
                `key "${key}" will never result in a contribution due to absence from aggregatable_values`
              )
            )
          }
        }
      })
    }
  })

  ctx.scope('aggregatable_values', () => {
    for (const key of allAggregatableValueKeys) {
      if (!triggerDataKeys.has(key)) {
        ctx.warning(
          `key "${key}"'s absence from aggregatable_trigger_data source_keys equivalent to presence with key_piece 0x0`
        )
      }
    }
  })
}

function triggerContextID(
  ctx: Context,
  j: Json,
  aggregatableSourceRegTime: Maybe<AggregatableSourceRegistrationTime>
): Maybe<string> {
  return string(ctx, j).filter((s) => {
    if (s.length > constants.maxLengthPerTriggerContextID) {
      ctx.error(
        `exceeds max length per trigger context ID (${s.length} > ${constants.maxLengthPerTriggerContextID})`
      )
      return false
    }
    if (aggregatableSourceRegTime.value === undefined) {
      ctx.error(
        `cannot be fully validated without a valid aggregatable_source_registration_time`
      )
      return false
    }
    if (
      aggregatableSourceRegTime.value !==
      AggregatableSourceRegistrationTime.exclude
    ) {
      ctx.error(
        `is prohibited for aggregatable_source_registration_time ${aggregatableSourceRegTime.value}`
      )
      return false
    }
    return true
  })
}

function aggregationCoordinatorOrigin(
  ctx: RegistrationContext,
  j: Json
): Maybe<string> {
  return suitableOrigin(ctx, j).filter((s) => {
    if (!ctx.vsv.aggregationCoordinatorOrigins.includes(s)) {
      const allowed = ctx.vsv.aggregationCoordinatorOrigins.join(', ')
      ctx.error(`must be one of the following: ${allowed}`)
      return false
    }
    return true
  })
}

export type Trigger = CommonDebug &
  FilterPair & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: AggregatableSourceRegistrationTime
    aggregatableValuesConfigurations: AggregatableValuesConfiguration[]
    aggregationCoordinatorOrigin: string
    eventTriggerData: EventTriggerDatum[]
    triggerContextID: string | null
    aggregatableDebugReporting: AggregatableDebugReportingConfig | null
  }

function trigger(ctx: RegistrationContext, j: Json): Maybe<Trigger> {
  return object(ctx, j)
    .map((j) => {
      const aggregatableSourceRegTimeVal = field(
        'aggregatable_source_registration_time',
        aggregatableSourceRegistrationTime,
        AggregatableSourceRegistrationTime.exclude
      )(ctx, j)

      return struct(ctx, j, {
        aggregatableTriggerData: field(
          'aggregatable_trigger_data',
          aggregatableTriggerData,
          []
        ),
        aggregatableValuesConfigurations: field(
          'aggregatable_values',
          aggregatableValuesConfigurations,
          []
        ),
        aggregatableDedupKeys: field(
          'aggregatable_deduplication_keys',
          aggregatableDedupKeys,
          []
        ),
        aggregatableSourceRegistrationTime: () => aggregatableSourceRegTimeVal,
        aggregationCoordinatorOrigin: aggregationCoordinatorOriginField,
        eventTriggerData: field('event_trigger_data', eventTriggerData, []),
        triggerContextID: field(
          'trigger_context_id',
          (ctx, j) => triggerContextID(ctx, j, aggregatableSourceRegTimeVal),
          null
        ),
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          (ctx, j) => struct(ctx, j, aggregatableDebugReportingConfig),
          null
        ),
        ...commonDebugFields,
        ...filterFields,
      })
    })
    .peek((t) => warnInconsistentAggregatableKeys(ctx, t))
}

export function validateJSON<T, C extends Context = Context>(
  ctx: C,
  json: string,
  f: CtxFunc<C, Json, Maybe<T>>
): [ValidationResult, Maybe<T>] {
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
  parseFullFlex: boolean = false,
  noteInfoGain: boolean = false
): [ValidationResult, Maybe<Source>] {
  return validateJSON(
    new SourceContext(vsv, parseFullFlex, sourceType, noteInfoGain),
    json,
    source
  )
}

export function validateTrigger(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  parseFullFlex: boolean = false
): [ValidationResult, Maybe<Trigger>] {
  return validateJSON(
    new RegistrationContext(
      vsv,
      parseFullFlex,
      constants.triggerAggregatableDebugTypes
    ),
    json,
    trigger
  )
}

export type EventLevelReport = {
  attributionDestination: string | string[]
  randomizedTriggerRate: number
  reportId: string
  scheduledReportTime: bigint
  sourceDebugKey: bigint | null
  sourceType: SourceType
  sourceEventId: bigint
  triggerData: bigint
  triggerDebugKey: bigint | null
  triggerSummaryBucket: [number, number] | null
}

function reportDestination(ctx: Context, j: Json): Maybe<string | string[]> {
  const suitableSiteNoExtraneous = (ctx: Context, j: Json) =>
    suitableSite(ctx, j, /*rejectExtraComponents=*/ true)

  return typeSwitch<string | string[]>(ctx, j, {
    string: (ctx, j) => suitableSiteNoExtraneous(ctx, j),
    list: (ctx, j) =>
      array(ctx, j, suitableSiteNoExtraneous, {
        minLength: 2,
        maxLength: 3,
      }).filter((v) => {
        for (let i = 1; i < v.length; ++i) {
          if (v[i]! <= v[i - 1]!) {
            ctx.error(
              'although order is semantically irrelevant, list must be sorted and contain no duplicates'
            )
            return false
          }
        }
        return true
      }),
  })
}

function randomizedTriggerRate(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j).filter((n) => isInRange(ctx, n, 0, 1))
}

function randomUuid(ctx: Context, j: Json): Maybe<string> {
  return string(ctx, j).filter((s) => {
    if (!uuid.validate(s)) {
      ctx.error('must be a valid UUID')
      return false
    }
    if (uuid.version(s) !== 4) {
      ctx.error('must be a version 4 (random) UUID')
      return false
    }
    return true
  })
}

function triggerSummaryBucket(ctx: Context, j: Json): Maybe<[number, number]> {
  let prev = 1
  let prevDesc = 'minimum bucket start'

  const endpoint = (ctx: Context, j: Json): Maybe<number> =>
    number(ctx, j)
      .filter((n) => isInteger(ctx, n))
      .filter((n) =>
        isInRange(
          ctx,
          n,
          prev,
          UINT32_MAX,
          `must be >= ${prevDesc} (${prev}) and <= uint32 max (${UINT32_MAX})`
        )
      )
      .peek((n) => {
        prev = n
        prevDesc = 'bucket start'
      })

  return array(ctx, j, endpoint, {
    minLength: 2,
    maxLength: 2,
    itemErrorAction: ItemErrorAction.earlyExit,
  }) as Maybe<[number, number]>
}

function eventLevelReport(
  ctx: GenericContext,
  j: Json
): Maybe<EventLevelReport> {
  return struct(ctx, j, {
    attributionDestination: field('attribution_destination', reportDestination),
    randomizedTriggerRate: field(
      'randomized_trigger_rate',
      randomizedTriggerRate
    ),
    reportId: field('report_id', randomUuid),
    scheduledReportTime: field('scheduled_report_time', int64),
    sourceDebugKey: field('source_debug_key', uint64, null),
    sourceEventId: field('source_event_id', uint64),
    sourceType: field('source_type', (ctx, j) =>
      enumerated(ctx, j, SourceType)
    ),
    triggerData: field('trigger_data', uint64),
    // TODO: Flex can issue multiple trigger debug keys.
    triggerDebugKey: field('trigger_debug_key', uint64, null),

    triggerSummaryBucket: ctx.parseFullFlex
      ? field('trigger_summary_bucket', triggerSummaryBucket)
      : () => some(null),
  })
}

export function validateEventLevelReport(
  json: string,
  parseFullFlex: boolean = false
): [ValidationResult, Maybe<EventLevelReport>] {
  return validateJSON(new GenericContext(parseFullFlex), json, eventLevelReport)
}
