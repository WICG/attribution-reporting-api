const uint64Regex = /^[0-9]+$/
const int64Regex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const limits = {
  maxAggregationKeys: 20,
  maxEntriesPerFilterData: 50,
  maxValuesPerFilterDataEntry: 50,
}

class State {
  constructor() {
    this.path = []
    this.errors = []
    this.warnings = []
  }

  error(msg) {
    this.errors.push({ path: [...this.path], msg })
  }

  warn(msg) {
    this.warnings.push({ path: [...this.path], msg })
  }

  scope(scope, f) {
    this.path.push(scope)
    f()
    this.path.pop()
  }

  result() {
    return { errors: this.errors, warnings: this.warnings }
  }

  validate(obj, checks) {
    if (!object()(this, obj)) {
      return
    }

    Object.entries(checks).forEach(([key, check]) =>
      this.scope(key, () => check(this, obj, key))
    )

    Object.keys(obj).forEach((key) => {
      if (!(key in checks)) {
        this.scope(key, () => this.warn('unknown field'))
      }
    })
  }
}

function required(f = () => {}) {
  return (state, object, key) => {
    if (key in object) {
      f(state, object[key])
      return
    }
    state.error('missing required field')
  }
}

function optional(f = () => {}) {
  return (state, object, key) => {
    if (key in object) {
      f(state, object[key])
    }
  }
}

function string(f = () => {}) {
  return (state, value) => {
    if (typeof value === 'string') {
      f(state, value)
      return
    }
    state.error('must be a string')
  }
}

function bool(state, value) {
  if (typeof value === 'boolean') {
    return
  }
  state.error('must be a boolean')
}

function isObject(value) {
  return typeof value === 'object' && value.constructor === Object
}

function isArray(value) {
  return value instanceof Array
}

function object(f = () => {}, maxKeys = Infinity) {
  return (state, value) => {
    if (isObject(value)) {
      const entries = Object.entries(value)

      if (entries.length > maxKeys) {
        state.error(`exceeds the maximum number of keys (${maxKeys})`)
      }

      entries.forEach(([key, value]) =>
        state.scope(key, () => f(state, key, value))
      )
      return true
    }
    state.error('must be an object')
  }
}

function list(f = () => {}, maxLength = Infinity, minLength = 0) {
  return (state, values) => {
    if (isArray(values)) {
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

const int64 = string((state, value) => {
  if (!int64Regex.test(value)) {
    state.error(`must be an int64 (must match ${int64Regex})`)
    return
  }

  value = BigInt(value)

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

const suitableUrl = string((state, url) => {
  try {
    url = new URL(url)
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

const destinationValue = (state, value) => {
  if (typeof value === 'string') {
    return suitableUrl(state, value)
  }
  if (isArray(value)) {
    return destinationList(state, value)
  }
  state.error('must be a list or a string')
}

const listOrObject = (f = () => {}, listMaxLength, listMinLength) => {
  return (state, value, key) => {
    if (isObject(value)) {
      return f(state, value, key)
    }

    if (isArray(value)) {
      return list(f, listMaxLength, listMinLength)(state, value, key)
    }

    state.error('must be a list or an object')
  }
}

// TODO: Check length of strings.
const filterData = () =>
  object((state, filter, values) => {
    if (filter === 'source_type') {
      state.error('is prohibited because it is implicitly set')
      return
    }

    list(string(), limits.maxValuesPerFilterDataEntry)(state, values)
  }, limits.maxEntriesPerFilterData)

const filters = () =>
  object((state, filter, values) => {
    list(string())(state, values)
  })

const orFilters = listOrObject(filters())

// TODO: check length of key
const aggregationKeys = object((state, key, value) => {
  hex128(state, value)
}, limits.maxAggregationKeys)

export function validateSource(source) {
  const state = new State()
  state.validate(source, {
    aggregatable_report_window: optional(uint64),
    event_report_window: optional(uint64),
    aggregation_keys: optional(aggregationKeys),
    debug_key: optional(uint64),
    debug_reporting: optional(bool),
    destination: required(destinationValue),
    expiry: optional(uint64),
    filter_data: optional(filterData()),
    priority: optional(int64),
    source_event_id: optional(uint64),
  })
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
const aggregatableValues = object((state, key, value) => {
  const max = 65536
  if (!Number.isInteger(value) || value <= 0 || value > max) {
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

export function validateTrigger(trigger) {
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

export function validateJSON(json, f) {
  let value
  try {
    value = JSON.parse(json)
  } catch (err) {
    return { errors: [{ msg: err.message }], warnings: [] }
  }
  return f(value)
}
