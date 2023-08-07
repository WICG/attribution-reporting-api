import { Issue, ValidationResult } from './issue'
const { parseList } = require('structured-headers')

function validateURL(item: any): string|undefined {
  if (typeof item !== 'string') {
    return 'must be a string'
  }

  let url
  try {
    url = new URL(item)
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

export function validateOsRegistration(str: string): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] }

  let list
  try {
    list = parseList(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    result.errors.push({ msg })
    return result
  }

  for (let i = 0; i < list.length; i++) {
    const [member, params] = list[i]
    const err = validateURL(member)
    if (err) {
      result.errors.push({ msg: err, path: [i] })
      continue
    }

    for (const [key, value] of params) {
      if (key === 'debug-reporting') {
        if (typeof value !== 'boolean') {
          result.errors.push({ msg: 'must be a boolean', path: [i, key] })
        }
      } else {
        result.warnings.push({ msg: 'unknown parameter', path: [i, key] })
      }
    }
  }

  return result
}
