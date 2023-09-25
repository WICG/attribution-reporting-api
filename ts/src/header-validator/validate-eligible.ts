import { Context, ValidationResult } from './context'
import { parseDictionary } from 'structured-headers'

export function validateEligible(str: string): ValidationResult {
  const ctx = new Context()

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return ctx.finish(msg)
  }

  for (const [key, value] of dict) {
    ctx.scope(key, () => {
      switch (key) {
        case 'event-source':
        case 'trigger':
          break
        case 'navigation-source':
          ctx.warning('may only be specified in browser-initiated requests')
          break
        default:
          ctx.warning('unknown dictionary key')
          break
      }

      if (value[0] !== true) {
        ctx.warning('ignoring dictionary value')
      }

      if (value[1].size !== 0) {
        ctx.warning('ignoring parameters')
      }
    })
  }

  return ctx.finish()
}
