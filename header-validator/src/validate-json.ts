import * as psl from 'psl'
import * as context from './context'

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

type FieldCheck = (ctx: Context, obj: JsonDict, key: string) => void

type FieldChecks = Record<string, FieldCheck>

function validate(ctx: Context, obj: Json, checks: FieldChecks): void {
  const d = object(ctx, obj)
  if (d === undefined) {
    return
  }

  Object.entries(checks).forEach(([key, check]) =>
    ctx.scope(key, () => check(ctx, d, key))
  )

  Object.keys(d).forEach((key) => {
    if (!(key in checks)) {
      ctx.scope(key, () => ctx.warning('unknown field'))
    }
  })
}

type CtxFunc<I, O> = (ctx: Context, i: I) => O

export type ValueCheck = CtxFunc<Json, void>

function field(f: ValueCheck, required: boolean): FieldCheck {
  return (ctx, obj, key) => {
    const v = obj[key]
    if (v === undefined) {
      if (required) {
        ctx.error('required')
      }
      return
    }
    f(ctx, v)
  }
}

const required = (f: ValueCheck) => field(f, /*required=*/ true)
const optional = (f: ValueCheck) => field(f, /*required=*/ false)

function string(ctx: Context, j: Json): string | undefined {
  if (typeof j === 'string') {
    return j
  }
  ctx.error('must be a string')
}

function bool(ctx: Context, j: Json): boolean | undefined {
  if (typeof j === 'boolean') {
    return
  }
  ctx.error('must be a boolean')
}

function isObject(j: Json): j is JsonDict {
  return j !== null && typeof j === 'object' && j.constructor === Object
}

function object(ctx: Context, j: Json): JsonDict | undefined {
  if (isObject(j)) {
    return j
  }
  ctx.error('must be an object')
}

function keyValues<V>(
  ctx: Context,
  j: Json,
  f: CtxFunc<[key: string, val: Json], V | undefined>,
  maxKeys: number = Infinity
): Map<string, V> | undefined {
  const d = object(ctx, j)
  if (d === undefined) {
    return
  }

  const entries = Object.entries(d)

  if (entries.length > maxKeys) {
    ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
  }

  const map = new Map<string, V>()
  let ok = true

  entries.forEach(([key, j]) =>
    ctx.scope(key, () => {
      const v = f(ctx, [key, j])
      if (v === undefined) {
        ok = false
        return
      }
      map.set(key, v)
    })
  )

  return ok ? map : undefined
}

type ListOpts = {
  minLength?: number
  maxLength?: number
}

function list(
  ctx: Context,
  j: Json,
  { minLength = 0, maxLength = Infinity }: ListOpts = {}
): Json[] | undefined {
  if (!Array.isArray(j)) {
    ctx.error('must be a list')
    return
  }

  if (j.length > maxLength || j.length < minLength) {
    ctx.error(`length must be in the range [${minLength}, ${maxLength}]`)
  }

  return j
}

function uint64(ctx: Context, j: Json): bigint | undefined {
  const s = string(ctx, j)
  if (s === undefined) {
    return
  }

  if (!uint64Regex.test(s)) {
    ctx.error(`must be a uint64 (must match ${uint64Regex})`)
    return
  }

  const int = BigInt(s)
  const max = 2n ** 64n - 1n
  if (int > max) {
    ctx.error('must fit in an unsigned 64-bit integer')
    return
  }

  return int
}

function triggerData(ctx: Context, j: Json): bigint | undefined {
  const n = uint64(ctx, j)
  if (n === undefined) {
    return
  }
  if (ctx.vsv.triggerDataCardinality === undefined) {
    return n
  }

  Object.entries(ctx.vsv.triggerDataCardinality).forEach(([t, c]) => {
    if (n >= c) {
      ctx.warning(
        `will be sanitized to ${n % c} if trigger is attributed to ${t} source`
      )
    }
  })

  return n
}

function number(ctx: Context, j: Json): number | undefined {
  if (typeof j === 'number') {
    return j
  }
  ctx.error('must be a number')
}

function nonNegativeInteger(ctx: Context, j: Json): number | undefined {
  const n = number(ctx, j)
  if (n === undefined) {
    return
  }

  if (!Number.isInteger(n) || n < 0) {
    ctx.error('must be a non-negative integer')
    return
  }

  return n
}

function positiveInteger(ctx: Context, j: Json): number | undefined {
  const n = number(ctx, j)
  if (n === undefined) {
    return
  }

  if (!Number.isInteger(n) || n <= 0) {
    ctx.error('must be a positive integer')
    return
  }

  return n
}

function int64(ctx: Context, j: Json): bigint | undefined {
  const s = string(ctx, j)
  if (s === undefined) {
    return
  }

  if (!int64Regex.test(s)) {
    ctx.error(`must be an int64 (must match ${int64Regex})`)
    return
  }

  const n = BigInt(s)

  const max = 2n ** (64n - 1n) - 1n
  const min = (-2n) ** (64n - 1n)
  if (n < min || n > max) {
    ctx.error('must fit in a signed 64-bit integer')
    return
  }

  return n
}

function hex128(ctx: Context, j: Json): bigint | undefined {
  const s = string(ctx, j)
  if (s === undefined) {
    return
  }

  if (!hex128Regex.test(s)) {
    ctx.error(`must be a hex128 (must match ${hex128Regex})`)
    return
  }

  return BigInt(s)
}

function suitableScope(
  ctx: Context,
  j: Json,
  label: string,
  scope: (url: URL) => string
): string | undefined {
  const s = string(ctx, j)
  if (s === undefined) {
    return
  }

  let url
  try {
    url = new URL(s)
  } catch {
    ctx.error('invalid URL')
    return
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    ctx.error('URL must use HTTP/HTTPS and be potentially trustworthy')
    return
  }

  const scoped = scope(url)
  if (s !== scoped) {
    ctx.warning(
      `URL components other than ${label} (${scoped}) will be ignored`
    )
  }
  return scoped
}

function suitableOrigin(ctx: Context, j: Json): string | undefined {
  return suitableScope(ctx, j, 'origin', (u) => u.origin)
}

function suitableSite(ctx: Context, j: Json): string | undefined {
  return suitableScope(
    ctx,
    j,
    'site',
    (u) => `${u.protocol}//${psl.get(u.hostname)}`
  )
}

function destination(ctx: Context, j: Json): Set<string> | undefined {
  if (typeof j === 'string') {
    const s = suitableSite(ctx, j)
    return s === undefined ? undefined : new Set([s])
  }
  if (Array.isArray(j)) {
    return set(ctx, j, suitableSite, { minLength: 1, maxLength: 3 })
  }
  ctx.error('must be a list or a string')
}

function maxEventLevelReports(ctx: Context, j: Json): number | undefined {
  if (
    typeof j === 'number' &&
    Number.isInteger(j) &&
    j >= 0 &&
    j <= limits.maxEventLevelReports
  ) {
    return j
  }

  ctx.error(
    `must be an integer in the range [0, ${limits.maxEventLevelReports}]`
  )
}

// TODO: ensure that first end_time is greater than start_time
function endTimes(ctx: Context, j: Json): number[] | undefined {
  let last = 0
  return array(
    ctx,
    j,
    (ctx, j) => {
      const n = positiveInteger(ctx, j)
      if (n === undefined) {
        return
      }

      if (n <= last) {
        ctx.error(`must be > previous value (${last})`)
        return
      }

      last = n
      return n
    },
    { minLength: 1, maxLength: 5 }
  )
}

function eventReportWindows(ctx: Context, j: Json): void {
  validate(ctx, j, {
    start_time: optional(nonNegativeInteger),
    end_times: required(endTimes),
  })
}

function legacyDuration(ctx: Context, j: Json): number | bigint | undefined {
  if (typeof j === 'number') {
    return nonNegativeInteger(ctx, j)
  }
  if (typeof j === 'string') {
    return uint64(ctx, j)
  }
  ctx.error('must be a non-negative integer or a string')
}

function collection(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, boolean>,
  opts?: ListOpts
): boolean {
  const js = list(ctx, j, opts)
  if (js === undefined) {
    return false
  }

  let ok = true
  js.forEach((j, i) =>
    ctx.scope(i, () => {
      if (!f(ctx, j)) {
        ok = false
      }
    })
  )
  return ok
}

function set(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, string | undefined>,
  opts?: ListOpts
): Set<string> | undefined {
  const set = new Set<string>()

  const ok = collection(
    ctx,
    j,
    (ctx, j) => {
      const v = f(ctx, j)
      if (v === undefined) {
        return false
      }
      if (set.has(v)) {
        ctx.warning(`duplicate value ${v}`)
      } else {
        set.add(v)
      }
      return true
    },
    opts
  )

  return ok ? set : undefined
}

function array<T>(
  ctx: Context,
  j: Json,
  f: CtxFunc<Json, T | undefined>,
  opts?: ListOpts
): T[] | undefined {
  const arr: T[] = []

  const ok = collection(
    ctx,
    j,
    (ctx, j) => {
      const v = f(ctx, j)
      if (v === undefined) {
        return false
      }
      arr.push(v)
      return true
    },
    opts
  )

  return ok ? arr : undefined
}

// TODO: Check length of strings.
function filterDataKeyValue(
  ctx: Context,
  [key, j]: [string, Json]
): Set<string> | undefined {
  if (key === 'source_type' || key === '_lookback_window') {
    ctx.error('is prohibited because it is implicitly set')
    return
  }
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return
  }

  return set(ctx, j, string, { maxLength: limits.maxValuesPerFilterDataEntry })
}

type FilterData = Map<string, Set<string>>

function filterData(ctx: Context, j: Json): FilterData | undefined {
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
): FilterValue | undefined {
  if (key === '_lookback_window') {
    return positiveInteger(ctx, j)
  }
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return
  }

  return set(ctx, j, (ctx, j) => {
    const s = string(ctx, j)
    if (s === undefined) {
      return
    }

    if (key === 'source_type' && !(s in SourceType)) {
      const allowed = Object.keys(SourceType).join(', ')
      ctx.warning(
        `unknown value ${s} (${key} can only match one of ${allowed})`
      )
    }

    return s
  })
}

type Filters = Map<string, FilterValue>

function filters(ctx: Context, j: Json): Filters | undefined {
  return keyValues(ctx, j, filterKeyValue)
}

function orFilters(ctx: Context, j: Json): Filters[] | undefined {
  if (Array.isArray(j)) {
    return array(ctx, j, filters)
  }
  if (isObject(j)) {
    const v = filters(ctx, j)
    return v === undefined ? undefined : [v]
  }
  ctx.error('must be a list or an object')
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
function aggregationKey(
  ctx: Context,
  [key, j]: [string, Json]
): bigint | undefined {
  return hex128(ctx, j)
}

function aggregationKeys(
  ctx: Context,
  j: Json
): Map<string, bigint> | undefined {
  return keyValues(
    ctx,
    j,
    aggregationKey,
    ctx.vsv.maxAggregationKeysPerAttribution
  )
}

export function validateSource(ctx: Context, source: Json): void {
  validate(ctx, source, {
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
  })
  if (
    isObject(source) &&
    'event_report_window' in source &&
    'event_report_windows' in source
  ) {
    ctx.error('event_report_window and event_report_windows in the same source')
  }
}

function sourceKeys(ctx: Context, j: Json): Set<string> | undefined {
  return set(ctx, j, string, {
    maxLength: ctx.vsv.maxAggregationKeysPerAttribution,
  })
}

function aggregatableTriggerData(ctx: Context, j: Json): void[] | undefined {
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
): number | undefined {
  const min = 1
  const max = 65536
  if (typeof j !== 'number' || !Number.isInteger(j) || j < min || j > max) {
    ctx.error(`must be an integer in the range [${min}, ${max}]`)
    return
  }
  return j
}

function aggregatableValues(
  ctx: Context,
  j: Json
): Map<string, number> | undefined {
  return keyValues(
    ctx,
    j,
    aggregatableKeyValue,
    ctx.vsv.maxAggregationKeysPerAttribution
  )
}

function eventTriggerData(ctx: Context, j: Json): void[] | undefined {
  return array(ctx, j, (ctx, j) =>
    validate(ctx, j, {
      trigger_data: optional(triggerData),
      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

function aggregatableDedupKeys(ctx: Context, j: Json): void[] | undefined {
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
): string | undefined {
  const s = string(ctx, j)
  if (s === undefined) {
    return
  }

  const exclude = 'exclude'
  const include = 'include'
  if (s === exclude || s === include) {
    return s
  }
  ctx.error(`must match '${exclude}' or '${include}' (case-sensitive)`)
}

export function validateTrigger(ctx: Context, trigger: Json): void {
  validate(ctx, trigger, {
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
