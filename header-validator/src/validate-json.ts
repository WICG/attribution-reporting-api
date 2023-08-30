import * as psl from 'psl'
import * as context from './context'
import { Maybe, None, Some } from './maybe'

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const limits = {
  maxEventLevelReports: 20,
  maxEntriesPerFilterData: 50,
  maxValuesPerFilterDataEntry: 50,
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

type Fields<T extends object> = {
  [K in keyof T]-?: CtxFunc<Json, T[K] | undefined>
}

function struct<T extends object>(ctx: Context, d: JsonDict, t: T, fields: Fields<T>): T | undefined {
  let ok = true

  for (const prop in fields) {
    const v = fields[prop](ctx, d)
    if (v === undefined) {
      ok = false
    } else {
      t[prop] = v
    }
  }

  return ok ? t : undefined
}

type FieldCheck = (ctx: Context, obj: JsonDict, key: string) => Maybe<any>

type FieldChecks = Record<string, FieldCheck>

function validate(
  ctx: Context,
  obj: Json,
  checks: FieldChecks
): Maybe<JsonDict> {
  return object(ctx, obj).filter((d) => {
    let ok = true
    Object.entries(checks).forEach(([key, check]) => {
      let itemOk = false
      ctx.scope(key, () => check(ctx, d, key).peek(() => (itemOk = true)))
      ok = ok && itemOk
    })

    Object.keys(d).forEach((key) => {
      if (!(key in checks)) {
        ctx.scope(key, () => ctx.warning('unknown field'))
      }
    })

    return ok
  })
}

type CtxFunc<I, O> = (ctx: Context, i: I) => O

export type ValueCheck = CtxFunc<Json, Maybe<any>>

function field(f: ValueCheck, required: boolean): FieldCheck {
  return (ctx, obj, key) => {
    const v = obj[key]
    if (v === undefined) {
      if (required) {
        ctx.error('required')
        return None
      }
      return new Some(undefined)
    }
    return f(ctx, v)
  }
}

const required = (f: ValueCheck) => field(f, /*required=*/ true)
const optional = (f: ValueCheck) => field(f, /*required=*/ false)

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

function eventReportWindows(ctx: Context, j: Json): Maybe<JsonDict> {
  return validate(ctx, j, {
    start_time: optional(nonNegativeInteger),
    end_times: required(endTimes),
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

const filterFields = {
  filters: optional(orFilters),
  not_filters: optional(orFilters),
}

const commonDebugFields = {
  debug_key: optional(uint64),
  debug_reporting: optional(bool),
}

const dedupKeyField = { deduplication_key: optional(uint64) }
const priorityField = { priority: optional(int64) }

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

export function validateSource(ctx: Context, source: Json): Maybe<JsonDict> {
  return validate(ctx, source, {
    aggregatable_report_window: optional(legacyDuration),
    aggregation_keys: optional(aggregationKeys),
    destination: required(destination),
    event_report_window: optional(legacyDuration),
    event_report_windows: optional(eventReportWindows),
    expiry: optional(legacyDuration),
    filter_data: optional(filterData),
    max_event_level_reports: optional(maxEventLevelReports),
    source_event_id: optional(uint64),
    ...commonDebugFields,
    ...priorityField,
  }).filter((d) => {
    if ('event_report_window' in d && 'event_report_windows' in d) {
      ctx.error(
        'event_report_window and event_report_windows in the same source'
      )
      return false
    }
    return true
  })
}

function sourceKeys(ctx: Context, j: Json): Maybe<Set<string>> {
  return set(ctx, j, string, {
    maxLength: ctx.vsv.maxAggregationKeysPerAttribution,
  })
}

function aggregatableTriggerData(ctx: Context, j: Json): Maybe<JsonDict[]> {
  return array(ctx, j, (ctx, j) =>
    validate(ctx, j, {
      key_piece: required(hex128),
      source_keys: optional(sourceKeys),
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

function eventTriggerData(ctx: Context, j: Json): Maybe<JsonDict[]> {
  return array(ctx, j, (ctx, j) =>
    validate(ctx, j, {
      trigger_data: optional(triggerData),
      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

function aggregatableDedupKeys(ctx: Context, j: Json): Maybe<JsonDict[]> {
  return array(ctx, j, (ctx, j) =>
    validate(ctx, j, {
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

export function validateTrigger(ctx: Context, trigger: Json): Maybe<JsonDict> {
  return validate(ctx, trigger, {
    aggregatable_trigger_data: optional(aggregatableTriggerData),
    aggregatable_values: optional(aggregatableValues),
    aggregatable_deduplication_keys: optional(aggregatableDedupKeys),
    aggregatable_source_registration_time: optional(
      aggregatableSourceRegistrationTime
    ),
    aggregation_coordinator_origin: optional(suitableOrigin),
    event_trigger_data: optional(eventTriggerData),
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
