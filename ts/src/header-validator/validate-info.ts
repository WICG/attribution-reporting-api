import { Context, ValidationResult } from './context'
import { Token, parseDictionary } from 'structured-headers'

export function validateInfo(str: string): ValidationResult {
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
        case 'preferred-platform':
          if (typeof value[0] !== 'object' || value[0].constructor !== Token) {
            ctx.error('must be a token')
            return
          }
          const token = value[0].toString()
          if (token !== 'os' && token !== 'web') {
            ctx.error('must be one of the following (case-sensitive): os, web')
            return
          }
          if (value[1].size !== 0) {
            ctx.warning('ignoring parameters')
          }
          break
        case 'report-header-errors':
          if (typeof value[0] !== 'boolean') {
            ctx.error('must be a boolean')
            return
          }
          if (value[1].size !== 0) {
            ctx.warning('ignoring parameters')
          }
          break
        default:
          ctx.warning('unknown dictionary key')
          break
      }
    })
  }

  return ctx.finish()
}
