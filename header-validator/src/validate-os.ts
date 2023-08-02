import { Issue, ValidationResult } from './issue'
const { parseList } = require('structured-headers')

function validateString(item): string {
  if (typeof item !== 'string') {
    return 'must be a string'
  }
}

function validateURL(urlStr: string): string {
  const err = validateString(urlStr)
  if (err) {
    return err
  }

  let url
  try {
    url = new URL(urlStr)
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

type ParamCheck = (value: any) => string

type ParamChecks = Record<string, ParamCheck>

function optional(f: ParamCheck): ParamCheck {
  return (param: any) => {
    if (param !== undefined) {
      return f(param)
    }
  }
}

function bool(value: any): string {
  if (typeof value === 'boolean') {
    return
  }
  return 'must be a boolean'
}

function validate(str: string, paramChecks: ParamChecks): ValidationResult {
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
      params.delete(param)
    })

    for (const key of params.keys()) {
      warnings.push({ msg: 'unknown parameter', path: [key] })
    }
  }

  return { errors, warnings }
}

export function validateOsRegistration(str: string): ValidationResult {
  return validate(str, {
    'debug-reporting': optional(bool),
  })
}
