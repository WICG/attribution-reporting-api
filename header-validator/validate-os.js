async function getParseListFunctionFromEnvironment() {
  let parseList = null
  if (typeof window === 'undefined') {
    // Environment = nodeJS -> Take structured header functions from the locally installed node module
    const structuredHeaderLib = await import('structured-headers')
    parseList = structuredHeaderLib.default.parseList
  } else {
    // Environment = browser -> Take structured header functions from the lib loaded from the CDN (see HTML)
    parseList = window.structuredHeader.parseList
  }
  return parseList
}

const parseList = await getParseListFunctionFromEnvironment()

function validateString(item) {
  if (typeof item !== 'string') {
    return 'must be a string'
  }
}

function validateURL(url) {
  const err = validateString(url)
  if (err) {
    return err
  }

  try {
    url = new URL(url)
  } catch {
    return 'must contain a valid URL'
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    return 'must contain a potentially trustworthy URL'
  }
}

function optional(f = () => {}) {
  return (param) => {
    if (param !== undefined) {
      return f(param)
    }
  }
}

function bool(value) {
  if (typeof value === 'boolean') {
    return
  }
  return 'must be a boolean'
}

function validate(str, paramChecks) {
  const errors = []
  const warnings = []

  let list
  try {
    list = parseList(str)
  } catch (err) {
    errors.push({ msg: err.toString() })
    return { errors, warnings }
  }

  for (const [item, params] of list) {
    const err = validateURL(item)
    if (err) {
      errors.push({ msg: err, path: [] })
    }

    Object.entries(paramChecks).forEach(([param, check]) => {
      const err = check(params.get(param))
      if (err) {
        errors.push({ msg: err, path: [param] })
      }
      params.delete(param);
    });

    for (const key of params.keys()) {
      warnings.push({ msg: 'unknown parameter', path: [key] })
    }
  }

  return { errors, warnings }
}

export function validateOsRegistration(str) {
  return validate(str, {
    'debug-reporting': optional(bool),
  })
}
