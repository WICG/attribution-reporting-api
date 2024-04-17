import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { Token, parseDictionary } from 'structured-headers'

export type Info = {
  preferredPlatform: null | 'os' | 'web'
  reportHeaderErrors: boolean
}

export function validateInfo(str: string): [ValidationResult, Maybe<Info>] {
  const ctx = new Context()

  let dict
  try {
    dict = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), Maybe.None]
  }

  let ok = true
  let preferredPlatform = null
  let reportHeaderErrors = false

  for (const [key, value] of dict) {
    ctx.scope(key, () => {
      switch (key) {
        case 'preferred-platform':
          if (typeof value[0] !== 'object' || value[0].constructor !== Token) {
            ctx.error('must be a token')
            ok = false
            return
          }
          const token = value[0].toString()
          if (token !== 'os' && token !== 'web') {
            ctx.error('must be one of the following (case-sensitive): os, web')
            ok = false
            return
          }
          if (value[1].size !== 0) {
            ctx.warning('ignoring parameters')
          }
          preferredPlatform = token
          break
        case 'report-header-errors':
          if (typeof value[0] !== 'boolean') {
            ctx.error('must be a boolean')
            ok = false
            return
          }
          if (value[1].size !== 0) {
            ctx.warning('ignoring parameters')
          }
          reportHeaderErrors = value[0]
          break
        default:
          ctx.warning('unknown dictionary key')
          break
      }
    })
  }

  return [
    ctx.finish(),
    ok ? Maybe.some({ preferredPlatform, reportHeaderErrors }) : Maybe.None,
  ]
}
