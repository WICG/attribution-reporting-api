import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { field, struct, validateDictionary } from './validate-structured'
import {
  Dictionary,
  InnerList,
  Item,
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

function presence(ctx: Context, v: Item | InnerList): Maybe<boolean> {
  if (v[0] !== true) {
    ctx.warning('ignoring dictionary value')
  }

  if (v[1].size !== 0) {
    ctx.warning('ignoring parameters')
  }

  return Maybe.some(true)
}

export function validateEligible(
  str: string
): [ValidationResult, Maybe<Eligible>] {
  return validateDictionary(new Context(), str, (ctx, d) =>
    struct(ctx, d, {
      navigationSource: field(navigationSourceKey, presence, false),
      eventSource: field(eventSourceKey, presence, false),
      trigger: field(triggerKey, presence, false),
    }).filter((v) => {
      if (v.navigationSource && (v.eventSource || v.trigger)) {
        ctx.error(
          `${navigationSourceKey} is mutually exclusive with ${eventSourceKey} and ${triggerKey}`
        )
        return false
      }
      return true
    })
  )
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
