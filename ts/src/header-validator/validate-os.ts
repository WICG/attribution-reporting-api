import { Context, ValidationResult } from './context'
import { InnerList, Item, parseList } from 'structured-headers'

function validateURL(ctx: Context, member: InnerList | Item): void {
  if (typeof member[0] !== 'string') {
    ctx.warning('ignored, must be a string')
    return
  }

  try {
    new URL(member[0])
  } catch {
    ctx.warning('ignored, must contain a valid URL')
    return
  }

  for (const [key, value] of member[1]) {
    ctx.scope(key, () => {
      if (key === 'debug-reporting') {
        if (typeof value !== 'boolean') {
          ctx.warning('ignored, must be a boolean')
        }
      } else {
        ctx.warning('unknown parameter')
      }
    })
  }
}

export function validateOsRegistration(str: string): ValidationResult {
  const ctx = new Context()

  let list
  try {
    list = parseList(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return ctx.finish(msg)
  }

  list.forEach((member, i) => ctx.scope(i, () => validateURL(ctx, member)))
  return ctx.finish()
}
