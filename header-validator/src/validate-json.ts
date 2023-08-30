import * as psl from 'psl'
import * as context from './context'
import { Maybe, None, Some } from './maybe'

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const secondsPerDay: number = 24 * 60 * 60

const limits = {
  maxEventLevelReports: 20,
  maxEntriesPerFilterData: 50,
  maxValuesPerFilterDataEntry: 50,
  sourceExpiryRange: [1 * secondsPerDay, 30 * secondsPerDay],
}

export type VendorSpecificValues = {
  maxAggregationKeysPerAttribution: number
  triggerDataCardinality: Record<SourceType, bigint>
}

class Context extends context.Context {
  constructor(readonly vsv: Partial<VendorSpecificValues>) {
    super()
  }
}

type StructFields<T extends object> = {
  [K in keyof T]-?: CtxFunc<JsonDict, Maybe<T[K]>>
}

function struct<T extends object>(
  ctx: Context,
  d: Json,
  fields: StructFields<T>
): Maybe<T> {
  return object(ctx, d).flatMap((d) => {
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

    for (const key in d) {
      ctx.scope(key, () => ctx.warning('unknown field'))
    }

    return ok ? new Some(t as T) : None
  })
}

type CtxFunc<I, O> = (ctx: Context, i: I) => O

export type ValueCheck = CtxFunc<Json, Maybe<any>>

function field<T>(
  name: string,
  f: CtxFunc<Json, Maybe<T>>,
  valueIfAbsent?: T
): CtxFunc<JsonDict, Maybe<T>> {
  return (ctx: Context, d: JsonDict): Maybe<T> =>
    ctx.scope(name, () => {
      const v = d[name]
      if (v === undefined) {
        if (valueIfAbsent === undefined) {
          ctx.error('required')
          return None
        }
        return new Some(valueIfAbsent)
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
  valueIfAbsent: T
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

    return new Some(valueIfAbsent)
  }
}

function string(ctx: Context, j: Json): Maybe<string> {
  if (typeof j === 'string') {
    return new Some(j)
  }
  ctx.error('must be a string')
  return None
}

function bool(ctx: Context, j: Json): Maybe<boolean> {
  if (typeof j === 'boolean') {
    return new Some(j)
  }
  ctx.error('must be a boolean')
  return None
}

function isObject(j: Json): j is JsonDict {
  return j !== null && typeof j === 'object' && j.constructor === Object
}

function object(ctx: Context, j: Json): Maybe<JsonDict> {
  if (isObject(j)) {
    return new Some(j)
  }
  ctx.error('must be an object')
  return None
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
      }

      return collection(ctx, entries, (ctx, [key, j]) =>
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
  if (!Array.isArray(j)) {
    ctx.error('must be a list')
    return None
  }

  if (j.length > maxLength || j.length < minLength) {
    ctx.error(`length must be in the range [${minLength}, ${maxLength}]`)
  }

  return new Some(j)
}

function pattern(
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
    .filter((s) => pattern(ctx, s, uint64Regex, 'must be a uint64'))
    .map(BigInt)
    .filter((n) =>
      range(
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
    Object.entries(ctx.vsv.triggerDataCardinality ?? []).forEach(([t, c]) => {
      if (n >= c) {
        ctx.warning(
          `will be sanitized to ${
            n % c
          } if trigger is attributed to ${t} source`
        )
      }
    })
  })
}

function number(ctx: Context, j: Json): Maybe<number> {
  if (typeof j === 'number') {
    return new Some(j)
  }
  ctx.error('must be a number')
  return None
}

function integer(ctx: Context, n: number): boolean {
  if (!Number.isInteger(n)) {
    ctx.error('must be an integer')
    return false
  }
  return true
}

function range<N extends bigint | number>(
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
    .filter((n) => integer(ctx, n))
    .filter((n) => range(ctx, n, 0, Infinity, 'must be non-negative'))
}

function positiveInteger(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => integer(ctx, n))
    .filter((n) => range(ctx, n, 1, Infinity, 'must be positive'))
}

function int64(ctx: Context, j: Json): Maybe<bigint> {
  return string(ctx, j)
    .filter((s) => pattern(ctx, s, int64Regex, 'must be an int64'))
    .map(BigInt)
    .filter((n) =>
      range(
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
    .filter((s) => pattern(ctx, s, hex128Regex, 'must be a hex128'))
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
  return new Some(scoped)
}

function suitableOrigin(ctx: Context, j: Json): Maybe<string> {
  return string(ctx, j).flatMap((s) =>
    suitableScope(ctx, s, 'origin', (u) => u.origin)
  )
}

function suitableSite(ctx: Context, j: Json): Maybe<string> {
  return string(ctx, j).flatMap((s) =>
    suitableScope(
      ctx,
      s,
      'site',
      (u) => `${u.protocol}//${psl.get(u.hostname)}`
    )
  )
}

function destination(ctx: Context, j: Json): Maybe<Set<string>> {
  if (typeof j === 'string') {
    return suitableSite(ctx, j).map((s) => new Set([s]))
  }
  if (Array.isArray(j)) {
    return set(ctx, j, suitableSite, { minLength: 1, maxLength: 3 })
  }
  ctx.error('must be a list or a string')
  return None
}

function maxEventLevelReports(ctx: Context, j: Json): Maybe<number> {
  return number(ctx, j)
    .filter((n) => integer(ctx, n))
    .filter((n) => range(ctx, n, 0, limits.maxEventLevelReports))
}

function endTimes(ctx: Context, j: Json): Maybe<number[]> {
  // TODO: Validate that end times are propertly ordered with respect to each
  // other and to start_time
  return array(ctx, j, positiveInteger, { minLength: 1, maxLength: 5 })
}

type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

function eventReportWindows(ctx: Context, j: Json): Maybe<EventReportWindows> {
  return struct(ctx, j, {
    startTime: field('start_time', nonNegativeInteger, 0),
    endTimes: field('end_times', endTimes),
  })
}

function legacyDuration(ctx: Context, j: Json): Maybe<number | bigint> {
  if (typeof j === 'number') {
    return nonNegativeInteger(ctx, j)
  }
  if (typeof j === 'string') {
    return uint64(ctx, j)
  }
  ctx.error('must be a non-negative integer or a string')
  return None
}

function collection<C extends context.PathComponent>(
  ctx: Context,
  js: Iterable<[C, Json]>,
  f: CtxFunc<[C, Json], Maybe<unknown>>
): boolean {
  let ok = true
  for (const [c, j] of js) {
    ctx.scope(c, () => {
      let itemOk = false
      f(ctx, [c, j]).peek(() => (itemOk = true))
      ok = ok && itemOk
    })
  }
  return ok
}

function set(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, Maybe<string>>,
  opts?: ListOpts
): Maybe<Set<string>> {
  const set = new Set<string>()

  return list(ctx, j, opts)
    .filter((js) =>
      collection(ctx, js.entries(), (ctx, [i, j]) =>
        f(ctx, j).peek((v) =>
          set.has(v) ? ctx.warning(`duplicate value ${v}`) : set.add(v)
        )
      )
    )
    .map(() => set)
}

function array<T>(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, Maybe<T>>,
  opts?: ListOpts
): Maybe<T[]> {
  const arr: T[] = []

  return list(ctx, j, opts)
    .filter((js) =>
      collection(ctx, js.entries(), (ctx, [i, j]) =>
        f(ctx, j).peek((v) => arr.push(v))
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

  return set(ctx, j, string, { maxLength: limits.maxValuesPerFilterDataEntry })
}

type FilterData = Map<string, Set<string>>

function filterData(ctx: Context, j: Json): Maybe<FilterData> {
  return keyValues(ctx, j, filterDataKeyValue, limits.maxEntriesPerFilterData)
}

export enum SourceType {
  event = 'event',
  navigation = 'navigation',
}

type FilterValue = Set<string> | number

function filterKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Maybe<FilterValue> {
  if (key === '_lookback_window') {
    return positiveInteger(ctx, j)
  }
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

type Filters = Map<string, FilterValue>

function filters(ctx: Context, j: Json): Maybe<Filters> {
  return keyValues(ctx, j, filterKeyValue)
}

function orFilters(ctx: Context, j: Json): Maybe<Filters[]> {
  if (Array.isArray(j)) {
    return array(ctx, j, filters)
  }
  if (isObject(j)) {
    return filters(ctx, j).map((v) => [v])
  }
  ctx.error('must be a list or an object')
  return None
}

type FilterPair = {
  positive: Filters[]
  negative: Filters[]
}

const filterFields: StructFields<FilterPair> = {
  positive: field('filters', orFilters, []),
  negative: field('not_filters', orFilters, []),
}

type CommonDebug = {
  debugKey: bigint | null
  debugReporting: boolean
}

const commonDebugFields: StructFields<CommonDebug> = {
  debugKey: field('debug_key', uint64, null),
  debugReporting: field('debug_reporting', bool, false),
}

type DedupKey = {
  dedupKey: bigint | null
}

const dedupKeyField: StructFields<DedupKey> = {
  dedupKey: field('deduplication_key', uint64, null),
}

type Priority = {
  priority: bigint
}

const priorityField: StructFields<Priority> = {
  priority: field('priority', int64, 0n),
}

// TODO: check length of key
function aggregationKey(ctx: Context, [key, j]: [string, Json]): Maybe<bigint> {
  return hex128(ctx, j)
}

function aggregationKeys(ctx: Context, j: Json): Maybe<Map<string, bigint>> {
  return keyValues(
    ctx,
    j,
    aggregationKey,
    ctx.vsv.maxAggregationKeysPerAttribution
  )
}

function clamp<N extends bigint | number>(
  ctx: Context,
  n: N,
  min: N,
  max: N
): N {
  if (n < min) {
    ctx.warning(`will be clamped to min of ${min}`)
    return min
  }
  if (n > max) {
    ctx.warning(`will be clamped to max of ${max}`)
    return max
  }
  return n
}

function expiry(ctx: Context, j: Json): Maybe<number | bigint> {
  return legacyDuration(ctx, j).map((n) =>
    clamp(ctx, n, limits.sourceExpiryRange[0], limits.sourceExpiryRange[1])
  )
}

type Source = CommonDebug &
  Priority & {
    aggregatableReportWindow: bigint | number | null
    aggregationKeys: Map<string, bigint>
    destination: Set<string>
    eventReportWindow: bigint | number | EventReportWindows | null
    expiry: bigint | number | null
    filterData: FilterData
    maxEventLevelReports: number | null
    sourceEventId: bigint
  }

export function validateSource(ctx: Context, source: Json): Maybe<Source> {
  return struct(ctx, source, {
    aggregatableReportWindow: field(
      'aggregatable_report_window',
      legacyDuration,
      null
    ),
    aggregationKeys: field('aggregation_keys', aggregationKeys, new Map()),
    destination: field('destination', destination),
    expiry: field('expiry', expiry, null),
    filterData: field('filter_data', filterData, new Map()),
    maxEventLevelReports: field(
      'max_event_level_reports',
      maxEventLevelReports,
      null
    ),
    sourceEventId: field('source_event_id', uint64, 0n),

    eventReportWindow: exclusive<bigint | number | EventReportWindows | null>(
      {
        event_report_window: legacyDuration,
        event_report_windows: eventReportWindows,
      },
      null
    ),

    ...commonDebugFields,
    ...priorityField,
  })
}

function sourceKeys(ctx: Context, j: Json): Maybe<Set<string>> {
  return set(ctx, j, string, {
    maxLength: ctx.vsv.maxAggregationKeysPerAttribution,
  })
}

type AggregatableTriggerDatum = FilterPair & {
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
  return number(ctx, j)
    .filter((n) => integer(ctx, n))
    .filter((n) => range(ctx, n, 1, 65536))
}

function aggregatableValues(ctx: Context, j: Json): Maybe<Map<string, number>> {
  return keyValues(
    ctx,
    j,
    aggregatableKeyValue,
    ctx.vsv.maxAggregationKeysPerAttribution
  )
}

type EventTriggerDatum = FilterPair &
  Priority &
  DedupKey & {
    triggerData: bigint
  }

function eventTriggerData(ctx: Context, j: Json): Maybe<EventTriggerDatum[]> {
  return array(ctx, j, (ctx, j) =>
    struct(ctx, j, {
      triggerData: field('trigger_data', triggerData, 0n),
      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

type AggregatableDedupKey = FilterPair & DedupKey

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

function aggregatableSourceRegistrationTime(
  ctx: Context,
  j: Json
): Maybe<string> {
  return string(ctx, j).filter((s) => {
    const exclude = 'exclude'
    const include = 'include'
    if (s === exclude || s === include) {
      return true
    }
    ctx.error(`must match '${exclude}' or '${include}' (case-sensitive)`)
    return false
  })
}

type Trigger = CommonDebug &
  FilterPair & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: string
    aggregatableValues: Map<string, number>
    aggregationCoordinatorOrigin: string | null
    eventTriggerData: EventTriggerDatum[]
  }

export function validateTrigger(ctx: Context, trigger: Json): Maybe<Trigger> {
  return struct(ctx, trigger, {
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
      'include'
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

export function validateJSON(
  json: string,
  f: ValueCheck,
  vsv: Partial<VendorSpecificValues>
): context.ValidationResult {
  const ctx = new Context(vsv)

  let value
  try {
    value = JSON.parse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return ctx.finish(msg)
  }

  f(ctx, value)
  return ctx.finish()
}
