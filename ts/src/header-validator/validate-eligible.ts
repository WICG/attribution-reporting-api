import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  Dictionary,
  parseDictionary,
  serializeDictionary,
} from 'structured-headers'

const navigationSourceKey = 'navigation-source'
const eventSourceKey = 'event-source'
const triggerKey = 'trigger'

export type Eligible = {
  navigationSource: boolean
  eventSource: boolean
  trigger: boolean
}

export function validateEligible(
  str: string
): [ValidationResult, Maybe<Eligible>] {
  const ctx = new Context()

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), Maybe.None]
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
    return [ctx.finish(), Maybe.None]
  }

  return [ctx.finish(), Maybe.some({ navigationSource, eventSource, trigger })]
}

export function serializeEligible(e: Eligible): string {
  const map: Dictionary = new Map()
  if (e.navigationSource) {
    map.set(navigationSourceKey, [true, new Map()])
  }
  if (e.eventSource) {
    map.set(eventSourceKey, [true, new Map()])
  }
  if (e.trigger) {
    map.set(triggerKey, [true, new Map()])
  }
  return serializeDictionary(map)
}
