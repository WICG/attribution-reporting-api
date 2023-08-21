import * as psl from 'psl'
import { Context, ValidationResult } from './context'

export type JsonDict = { [key: string]: Json }
export type Json = null|boolean|number|string|Json[]|JsonDict

const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const limits = {
  maxAggregationKeys: 20,
  maxEventLevelReports: 20,
  maxEntriesPerFilterData: 50,
  maxValuesPerFilterDataEntry: 50,
}

type FieldCheck = (ctx: Context, obj: JsonDict, key: string) => void

type FieldChecks = Record<string, FieldCheck>

function validate(ctx: Context, obj: Json, checks: FieldChecks): void {
  record((ctx, obj) => {
    Object.entries(checks).forEach(([key, check]) =>
      ctx.scope(key, () => check(ctx, obj, key))
    )

    Object.keys(obj).forEach((key) => {
      if (!(key in checks)) {
        ctx.scope(key, () => ctx.warning('unknown field'))
      }
    })
  })(ctx, obj)
}

export type ValueCheck = (ctx: Context, value: Json) => void

function required(f: ValueCheck): FieldCheck {
  return (ctx, obj, key) => {
    if (key in obj) {
      f(ctx, obj[key])
      return
    }
    ctx.error('required')
  }
}

function optional(f: ValueCheck): FieldCheck {
  return (ctx, obj, key) => {
    if (key in obj) {
      f(ctx, obj[key])
    }
  }
}

type StringCheck = (ctx: Context, value: string) => void

function string(f: StringCheck = (a, b) => {}): ValueCheck {
  return (ctx, value) => {
    if (typeof value === 'string') {
      f(ctx, value)
      return
    }
    ctx.error('must be a string')
  }
}

function bool(ctx: Context, value: Json): void {
  if (typeof value === 'boolean') {
    return
  }
  ctx.error('must be a boolean')
}

function isObject(value: Json): value is JsonDict {
  return value !== null && typeof value === 'object' && value.constructor === Object
}

type RecordCheck = (ctx: Context, value: JsonDict) => void

function record(f: RecordCheck): ValueCheck {
  return (ctx, value) => {
    if (isObject(value)) {
      f(ctx, value)
      return
    }
    ctx.error('must be an object')
  }
}

type KeyValueCheck = (ctx: Context, key: string, value: Json) => void

function keyValues(f: KeyValueCheck, maxKeys = Infinity): ValueCheck {
  return record((ctx, value) => {
    const entries = Object.entries(value)

    if (entries.length > maxKeys) {
      ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
    }

    entries.forEach(([key, value]) =>
      ctx.scope(key, () => f(ctx, key, value))
    )
  })
}

type ListOpts = {
  minLength?: number,
  maxLength?: number,
}

function list(f: ValueCheck, {
  minLength = 0,
  maxLength = Infinity,
}: ListOpts = {}): ValueCheck {
  return (ctx, values) => {
    if (Array.isArray(values)) {
      if (values.length > maxLength || values.length < minLength) {
        ctx.error(`length must be in the range [${minLength}, ${maxLength}]`)
      }

      values.forEach((value, index) => ctx.scope(index, () => f(ctx, value)))
      return
    }
    ctx.error('must be a list')
  }
}

const uint64 = string((ctx, value) => {
  if (!uint64Regex.test(value)) {
    ctx.error(`must be a uint64 (must match ${uint64Regex})`)
    return
  }

  const max = 2n ** 64n - 1n
  if (BigInt(value) > max) {
    ctx.error('must fit in an unsigned 64-bit integer')
  }
})

type NumberCheck = (ctx: Context, value: number) => void

function number(f: NumberCheck): ValueCheck {
  return (ctx, value) => {
    if (typeof value === 'number') {
      f(ctx, value)
      return
    }
    ctx.error('must be a number')
  }
}

const nonNegativeInteger = number((ctx, value) => {
  if (!Number.isInteger(value) || value < 0) {
    ctx.error('must be a non-negative integer')
  }
})

const positiveInteger = number((ctx, value) => {
  if (!Number.isInteger(value) || value <= 0) {
    ctx.error('must be a positive integer')
  }
})

const int64 = string((ctx, str) => {
  if (!int64Regex.test(str)) {
    ctx.error(`must be an int64 (must match ${int64Regex})`)
    return
  }

  const value = BigInt(str)

  const max = 2n ** (64n - 1n) - 1n
  const min = (-2n) ** (64n - 1n)
  if (value < min || value > max) {
    ctx.error('must fit in a signed 64-bit integer')
  }
})

const hex128 = string((ctx, value) => {
  if (!hex128Regex.test(value)) {
    return ctx.error(`must be a hex128 (must match ${hex128Regex})`)
  }
})

enum SuitableScope {
  Origin = 'origin',
  Site = 'site',
}

function suitableOriginOrSite(scope: SuitableScope): ValueCheck {
  return string((ctx, value) => {
    let url
    try {
      url = new URL(value)
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
      ctx.error('URL must be potentially trustworthy')
    }

    let scoped
    switch (scope) {
      case SuitableScope.Origin:
        scoped = url.origin
        break
      case SuitableScope.Site:
        scoped = `${url.protocol}//${psl.get(url.hostname)}`
        break
    }

    if (value !== scoped) {
      ctx.warning(`URL components other than ${scope} (${scoped}) will be ignored`)
    }
  })
}

const suitableOrigin = suitableOriginOrSite(SuitableScope.Origin)
const suitableSite = suitableOriginOrSite(SuitableScope.Site)

const destinationList = list(suitableSite, {minLength: 1, maxLength: 3})

function destinationValue(ctx: Context, value: Json): void {
  if (typeof value === 'string') {
    return suitableSite(ctx, value)
  }
  if (Array.isArray(value)) {
    return destinationList(ctx, value)
  }
  ctx.error('must be a list or a string')
}

function maxEventLevelReports(ctx: Context, value: Json): void {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > limits.maxEventLevelReports) {
      ctx.error('must be an integer in the range [0, 20]')
    }
  } else {
    ctx.error('must be an integer in the range [0, 20]')
  }
}

function eventReportWindows(ctx: Context, value: Json): void {
  // TODO(csharrison): Consider validating that the list of end times
  // is properly ordered.
  validate(ctx, value, {
    start_time: optional(nonNegativeInteger),
    end_times: required(list(positiveInteger, {minLength: 1, maxLength: 5})),
  })
}

function legacyDuration(ctx: Context, value: Json): void {
  if (typeof value === 'number') {
    return nonNegativeInteger(ctx, value)
  }
  if (typeof value === 'string') {
    return uint64(ctx, value)
  }
  ctx.error('must be a non-negative integer or a string')
}

function listOrKeyValues(f: ValueCheck, listOpts: ListOpts = {}): ValueCheck {
  return (ctx, value) => {
    if (isObject(value)) {
      return f(ctx, value)
    }

    if (Array.isArray(value)) {
      return list(f, listOpts)(ctx, value)
    }

    ctx.error('must be a list or an object')
  }
}

function unique(): StringCheck {
  const set = new Set()
  return (ctx, value) => {
    if (set.has(value)) {
      ctx.warning(`duplicate value ${value}`)
    } else {
      set.add(value)
    }
  }
}

// TODO: Check length of strings.
const filterData = () =>
  keyValues((ctx, filter, values) => {
    if (filter === 'source_type' || filter === '_lookback_window') {
      ctx.error('is prohibited because it is implicitly set')
      return
    }

    list(string(unique()), {maxLength: limits.maxValuesPerFilterDataEntry})(ctx, values)
  }, limits.maxEntriesPerFilterData)

enum SourceType {
  event = 'event',
  navigation = 'navigation',
}

const filters = () =>
  keyValues((ctx, filter, values) => {
    if (filter === '_lookback_window') {
      positiveInteger(ctx, values);
      return
    }

    const checkUnique = unique()

    list(string((ctx, value) => {
      if (filter === 'source_type' && !(value in SourceType)) {
        const allowed = Object.keys(SourceType).join(', ')
        ctx.warning(`unknown value ${value} (${filter} can only match one of ${allowed})`)
      }

      checkUnique(ctx, value)
    }))(ctx, values)
  })

const orFilters = listOrKeyValues(filters())

// TODO: check length of key
const aggregationKeys = keyValues((ctx, key, value) => {
  hex128(ctx, value)
}, limits.maxAggregationKeys)

export function validateSource(ctx: Context, source: Json): void {
  validate(ctx, source, {
    aggregatable_report_window: optional(legacyDuration),
    event_report_window: optional(legacyDuration),
    event_report_windows: optional(eventReportWindows),
    aggregation_keys: optional(aggregationKeys),
    debug_key: optional(uint64),
    debug_reporting: optional(bool),
    destination: required(destinationValue),
    expiry: optional(legacyDuration),
    filter_data: optional(filterData()),
    priority: optional(int64),
    source_event_id: optional(uint64),
    max_event_level_reports: optional(maxEventLevelReports),
  })
  if (isObject(source) && 'event_report_window' in source && 'event_report_windows' in source) {
    ctx.error('event_report_window and event_report_windows in the same source')
  }
}

const aggregatableTriggerData = list((ctx, value) => validate(ctx, value, {
  filters: optional(orFilters),
  key_piece: required(hex128),
  not_filters: optional(orFilters),
  source_keys: optional(list(string(unique()), {maxLength: limits.maxAggregationKeys})),
}))

// TODO: check length of key
const aggregatableValues = keyValues((ctx, key, value) => {
  const max = 65536
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > max) {
    ctx.error(`must be an integer in the range (1, ${max}]`)
  }
}, limits.maxAggregationKeys)

const eventTriggerData = list((ctx, value) => validate(ctx, value, {
  deduplication_key: optional(uint64),
  filters: optional(orFilters),
  not_filters: optional(orFilters),
  priority: optional(int64),
  trigger_data: optional(uint64),
}))

const aggregatableDedupKeys = list((ctx, value) => validate(ctx, value, {
  deduplication_key: optional(uint64),
  filters: optional(orFilters),
  not_filters: optional(orFilters),
}))

const aggregatableSourceRegistrationTime = string((ctx, value) => {
  const exclude = 'exclude'
  const include = 'include'
  if (value === exclude || value === include) {
    return
  }
  ctx.error(`must match '${exclude}' or '${include}' (case-sensitive)`)
})

export function validateTrigger(ctx: Context, trigger: Json): void {
  validate(ctx, trigger, {
    aggregatable_trigger_data: optional(aggregatableTriggerData),
    aggregatable_values: optional(aggregatableValues),
    aggregation_coordinator_origin: optional(suitableOrigin),
    debug_key: optional(uint64),
    debug_reporting: optional(bool),
    event_trigger_data: optional(eventTriggerData),
    filters: optional(orFilters),
    not_filters: optional(orFilters),
    aggregatable_deduplication_keys: optional(aggregatableDedupKeys),
    aggregatable_source_registration_time : optional(aggregatableSourceRegistrationTime),
  })
}

export function validateJSON(json: string, f: ValueCheck): ValidationResult {
  const ctx = new Context()

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
