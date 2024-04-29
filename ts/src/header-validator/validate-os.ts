import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  InnerList,
  Item,
  List,
  parseList,
  serializeList,
} from 'structured-headers'

export type OsItem = {
  url: URL
  debugReporting: boolean
}

function parseItem(ctx: Context, member: InnerList | Item): OsItem | undefined {
  if (typeof member[0] !== 'string') {
    ctx.warning('ignored, must be a string')
    return
  }

  let url
  try {
    url = new URL(member[0])
  } catch {
    ctx.warning('ignored, must contain a valid URL')
    return
  }

  let debugReporting = false

  for (const [key, value] of member[1]) {
    ctx.scope(key, () => {
      if (key === 'debug-reporting') {
        if (typeof value !== 'boolean') {
          ctx.warning('ignored, must be a boolean')
        } else {
          debugReporting = value
        }
      } else {
        ctx.warning('unknown parameter')
      }
    })
  }

  return { url, debugReporting }
}

export function validateOsRegistration(
  str: string
): [ValidationResult, Maybe<OsItem[]>] {
  const ctx = new Context()

  let list
  try {
    list = parseList(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), Maybe.None]
  }

  const items: OsItem[] = []
  list.forEach((member, i) =>
    ctx.scope(i, () => {
      const item = parseItem(ctx, member)
      if (item) {
        items.push(item)
      }
    })
  )
  return [ctx.finish(), Maybe.some(items)]
}

export function serializeOsRegistration(items: OsItem[]): string {
  const list: List = []
  for (const item of items) {
    list.push([
      item.url.toString(),
      new Map([['debug-reporting', item.debugReporting]]),
    ])
  }
  return serializeList(list)
}
