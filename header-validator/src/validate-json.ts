import { Issue, PathComponent, ValidationResult } from './issue'

export type JsonDict = { [key: string]: Json }
export type Json = null|boolean|number|string|Array<Json>|JsonDict

const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const limits = {
  maxAggregationKeys: 20,
  maxEventLevelReports: 20,
  maxEntriesPerFilterData: 50,
  maxValuesPerFilterDataEntry: 50,
}

type FieldCheck = (state: State, obj: JsonDict, key: string) => void

type FieldChecks = Record<string, FieldCheck>

class State {
  private readonly path: Array<PathComponent> = []
  private readonly errors: Array<Issue> = []
  private readonly warnings: Array<Issue> = []

  error(msg: string): void {
    this.errors.push({ path: [...this.path], msg })
  }

  warn(msg: string): void {
    this.warnings.push({ path: [...this.path], msg })
  }

  scope(scope: PathComponent, f: () => void): void {
    this.path.push(scope)
    f()
    this.path.pop()
  }

  result(): ValidationResult {
    return { errors: this.errors, warnings: this.warnings }
  }

  validate(obj: Json, checks: FieldChecks): void {
    record((state, obj) => {
      Object.entries(checks).forEach(([key, check]) =>
        this.scope(key, () => check(this, obj, key))
      )

      Object.keys(obj).forEach((key) => {
        if (!(key in checks)) {
          this.scope(key, () => this.warn('unknown field'))
        }
      })
    })(this, obj)
  }
}

type ValueCheck = (state: State, value: Json) => void

function required(f: ValueCheck): FieldCheck {
  return (state, obj, key) => {
    if (key in obj) {
      f(state, obj[key])
      return
    }
    state.error('missing required field')
  }
}

function optional(f: ValueCheck): FieldCheck {
  return (state, obj, key) => {
    if (key in obj) {
      f(state, obj[key])
    }
  }
}

type StringCheck = (state: State, value: string) => void

function string(f: StringCheck = (a, b) => {}): ValueCheck {
  return (state, value) => {
    if (typeof value === 'string') {
      f(state, value)
      return
    }
    state.error('must be a string')
  }
}

function bool(state: State, value: Json): void {
  if (typeof value === 'boolean') {
    return
  }
  state.error('must be a boolean')
}

function isObject(value: Json): value is JsonDict {
  return value !== null && typeof value === 'object' && value.constructor === Object
}

type RecordCheck = (state: State, value: JsonDict) => void

function record(f: RecordCheck): ValueCheck {
  return (state, value) => {
    if (isObject(value)) {
      f(state, value)
      return
    }
    state.error('must be an object')
  }
}

type KeyValueCheck = (state: State, key: string, value: Json) => void

function keyValues(f: KeyValueCheck, maxKeys = Infinity): ValueCheck {
  return record((state, value) => {
    const entries = Object.entries(value)

    if (entries.length > maxKeys) {
      state.error(`exceeds the maximum number of keys (${maxKeys})`)
    }

    entries.forEach(([key, value]) =>
      state.scope(key, () => f(state, key, value))
    )
  })
}

function list(f: ValueCheck, maxLength: number = Infinity, minLength: number = 0): ValueCheck {
  return (state, values) => {
    if (Array.isArray(values)) {
      if (values.length > maxLength || values.length < minLength) {
        state.error(
          `List size out of expected bounds. Size must be within [${minLength}, ${maxLength}]`
        )
      }

      values.forEach((value, index) =>
        state.scope(index, () => f(state, value))
      )
      return
    }
    state.error('must be a list')
  }
}

const uint64 = string((state, value) => {
  if (!uint64Regex.test(value)) {
    state.error(`must be a uint64 (must match ${uint64Regex})`)
    return
  }

  const max = 2n ** 64n - 1n
  if (BigInt(value) > max) {
    state.error('must fit in an unsigned 64-bit integer')
  }
})

type NumberCheck = (state: State, value: number) => void

function number(f: NumberCheck): ValueCheck {
  return (state, value) => {
    if (typeof value === 'number') {
      f(state, value)
      return
    }
    state.error('must be a number')
  }
}

const nonNegativeInteger = number((state, value) => {
  if (!Number.isInteger(value) || value < 0) {
    state.error('must be a non-negative integer')
  }
})

const positiveInteger = number((state, value) => {
  if (!Number.isInteger(value) || value <= 0) {
    state.error('must be a positive integer')
  }
})

const int64 = string((state, str) => {
  if (!int64Regex.test(str)) {
    state.error(`must be an int64 (must match ${int64Regex})`)
    return
  }

  const value = BigInt(str)

  const max = 2n ** (64n - 1n) - 1n
  const min = (-2n) ** (64n - 1n)
  if (value < min || value > max) {
    state.error('must fit in a signed 64-bit integer')
  }
})

const hex128 = string((state, value) => {
  if (!hex128Regex.test(value)) {
    return state.error(`must be a hex128 (must match ${hex128Regex})`)
  }
})

const suitableUrl = string((state, value) => {
  let url
  try {
    url = new URL(value)
  } catch {
    state.error('must contain a valid URL')
    return
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    state.error('must contain a potentially trustworthy URL')
  }

  if (url.pathname !== '/') {
    state.warn('contains a path that will be ignored')
  }

  if (url.search !== '') {
    state.warn('contains a query string that will be ignored')
  }

  if (url.hash !== '') {
    state.warn('contains a fragment that will be ignored')
  }
})

const destinationList = list(suitableUrl, 3, 1)

function destinationValue(state: State, value: Json): void {
  if (typeof value === 'string') {
    return suitableUrl(state, value)
  }
  if (Array.isArray(value)) {
    return destinationList(state, value)
  }
  state.error('must be a list or a string')
}

function maxEventLevelReports(state: State, value: Json): void {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > limits.maxEventLevelReports) {
      state.error('must be an integer in the range [0, 20]')
    }
  } else {
    state.error('must be an integer in the range [0, 20]')
  }
}

function eventReportWindows(state: State, value: Json): void {
  // TODO(csharrison): Consider validating that the list of end times
  // is properly ordered.
  state.validate(value, {
    start_time: optional(nonNegativeInteger),
    end_times: required(list(positiveInteger, 5, 1))
  })
}

function legacyDuration(state: State, value: Json): void {
  if (typeof value === 'number') {
    return nonNegativeInteger(state, value)
  }
  if (typeof value === 'string') {
    return uint64(state, value)
  }
  state.error('must be a non-negative integer or a string')
}

function listOrKeyValues(f: ValueCheck, listMaxLength: number = Infinity, listMinLength: number = 0): ValueCheck {
  return (state, value) => {
    if (isObject(value)) {
      return f(state, value)
    }

    if (Array.isArray(value)) {
      return list(f, listMaxLength, listMinLength)(state, value)
    }

    state.error('must be a list or an object')
  }
}

// TODO: Check length of strings.
const filterData = () =>
  keyValues((state, filter, values) => {
    if (filter === 'source_type') {
      state.error('is prohibited because it is implicitly set')
      return
    }

    list(string(), limits.maxValuesPerFilterDataEntry)(state, values)
  }, limits.maxEntriesPerFilterData)

const filters = () =>
  keyValues((state, filter, values) => {
    list(string())(state, values)
  })

const orFilters = listOrKeyValues(filters())

// TODO: check length of key
const aggregationKeys = keyValues((state, key, value) => {
  hex128(state, value)
}, limits.maxAggregationKeys)

export function validateSource(source: Json): ValidationResult {
  const state = new State()
  state.validate(source, {
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
    state.error('event_report_window and event_report_windows in the same source')
  }
  return state.result()
}

const aggregatableTriggerData = list(
  (state, value) =>
    state.validate(value, {
      filters: optional(orFilters),
      key_piece: required(hex128),
      not_filters: optional(orFilters),
      source_keys: optional(list(string(), limits.maxAggregationKeys)),
    }))

// TODO: check length of key
const aggregatableValues = keyValues((state, key, value) => {
  const max = 65536
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > max) {
    state.error(`must be an integer in the range (1, ${max}]`)
  }
}, limits.maxAggregationKeys)

const eventTriggerData = list(
  (state, value) =>
    state.validate(value, {
      deduplication_key: optional(uint64),
      filters: optional(orFilters),
      not_filters: optional(orFilters),
      priority: optional(int64),
      trigger_data: optional(uint64),
    }))

const aggregatableDedupKeys = list(
  (state, value) =>
    state.validate(value, {
      deduplication_key: optional(uint64),
      filters: optional(filters()),
      not_filters: optional(filters()),
    }))

const aggregatableSourceRegistrationTime = string((state, value) => {
  const exclude = 'exclude'
  const include = 'include'
  if (value === exclude || value === include) {
    return
  }
  state.error(`must match '${exclude}' or '${include}' (case-sensitive)`)
})

export function validateTrigger(trigger: Json): ValidationResult {
  const state = new State()
  state.validate(trigger, {
    aggregatable_trigger_data: optional(aggregatableTriggerData),
    aggregatable_values: optional(aggregatableValues),
    aggregation_coordinator_origin: optional(suitableUrl),
    debug_key: optional(uint64),
    debug_reporting: optional(bool),
    event_trigger_data: optional(eventTriggerData),
    filters: optional(orFilters),
    not_filters: optional(orFilters),
    aggregatable_deduplication_keys: optional(aggregatableDedupKeys),
    aggregatable_source_registration_time : optional(aggregatableSourceRegistrationTime),
  })
  return state.result()
}

export function validateJSON(json: string, f: (value: Json) => ValidationResult) {
  let value
  try {
    value = JSON.parse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return { errors: [{ msg }], warnings: [] }
  }
  return f(value)
}
