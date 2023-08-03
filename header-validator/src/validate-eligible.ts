import { ValidationResult } from './issue'
const { parseDictionary } = require('structured-headers')

export function validateEligible(str: string): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] }

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    result.errors.push({ msg })
    return result
  }

  for (const [key, value] of dict) {
    switch (key) {
      case 'event-source':
      case 'trigger':
        break
      case 'navigation-source':
        result.warnings.push({
          msg: 'may only be specified in browser-initiated requests',
          path: [key],
        })
        break
      default:
        result.warnings.push({ msg: 'unknown dictionary key', path: [key] })
        break
    }

    if (value[0] !== true) {
      result.warnings.push({ msg: 'ignoring dictionary value', path: [key] })
    }

    if (value[1].size !== 0) {
      result.warnings.push({ msg: 'ignoring parameters', path: [key] })
    }
  }

  return result
}
