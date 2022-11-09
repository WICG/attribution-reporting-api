async function getParseItemFunctionFromEnvironment() {
  let parseItem = null
  if (typeof window === 'undefined') {
    // Environment = nodeJS -> Take structured header functions from the locally installed node module
    const structuredHeaderLib = await import('structured-headers')
    parseItem = structuredHeaderLib.default.parseItem
  } else {
    // Environment = browser -> Take structured header functions from the lib loaded from the CDN (see HTML)
    parseItem = window.structuredHeader.parseItem
  }
  return parseItem
}

const parseItem = await getParseItemFunctionFromEnvironment()

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

function validate(str, paramChecks) {
  const errors = []
  const warnings = []

  let item, params
  try {
    [item, params] = parseItem(str)
  } catch (err) {
    errors.push({ msg: err.toString() })
    return { errors, warnings }
  }

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

  return { errors, warnings }
}

export function validateRegisterOsSource(str) {
  return validate(str, {})
}

export function validateRegisterOsTrigger(str) {
  return validate(str, {})
}
