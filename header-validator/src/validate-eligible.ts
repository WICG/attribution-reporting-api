import { ValidationResult } from './issue'
const { parseDictionary } = require('structured-headers')

export function validateEligible(str: string): ValidationResult {
  const errors = []
  const warnings = []

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    errors.push({ msg: err.toString() })
    return { errors, warnings }
  }

  for (const [key, value] of dict) {
    switch (key) {
      case 'event-source':
      case 'trigger':
        break
      case 'navigation-source':
        warnings.push({
          msg: 'may only be specified in browser-initiated requests',
          path: [key],
        })
        break
      default:
        warnings.push({ msg: 'unknown dictionary key', path: [key] })
        break
    }

    if (value[0] !== true) {
      warnings.push({ msg: 'ignoring dictionary value', path: [key] })
    }

    if (value[1].size !== 0) {
      warnings.push({ msg: 'ignoring parameters', path: [key] })
    }
  }

  return { errors, warnings }
}
