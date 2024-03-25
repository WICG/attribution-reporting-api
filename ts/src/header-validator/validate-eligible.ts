import { Context, ValidationResult } from './context'
import { parseDictionary } from 'structured-headers'

const navigationSourceKey = 'navigation-source'
const eventSourceKey = 'event-source'
const triggerKey = 'trigger'

export function validateEligible(str: string): ValidationResult {
  const ctx = new Context()

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return ctx.finish(msg)
  }

  let navigationSource = false
  let eventSource = false
  let trigger = false

  for (const [key, value] of dict) {
    ctx.scope(key, () => {
      switch (key) {
        case eventSourceKey:
          eventSource = true
          break
        case triggerKey:
          trigger = true
          break
        case navigationSourceKey:
          navigationSource = true
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

  if (navigationSource && (eventSource || trigger)) {
    ctx.error(
      `${navigationSourceKey} is mutually exclusive with ${eventSourceKey} and ${triggerKey}`
    )
  }

  return ctx.finish()
}
