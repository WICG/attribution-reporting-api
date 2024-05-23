import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { field, struct, validateDictionary } from './validate-structured'
import {
  Dictionary,
  InnerList,
  Item,
  Token,
  serializeDictionary,
} from 'structured-headers'

export type PreferredPlatform = null | 'os' | 'web'

export type Info = {
  preferredPlatform: PreferredPlatform
  reportHeaderErrors: boolean
}

function preferredPlatform(
  ctx: Context,
  v: Item | InnerList
): Maybe<PreferredPlatform> {
  if (!(v[0] instanceof Token)) {
    ctx.error('must be a token')
    return Maybe.None
  }
  const token = v[0].toString()
  if (token !== 'os' && token !== 'web') {
    ctx.error('must be one of the following (case-sensitive): os, web')
    return Maybe.None
  }
  if (v[1].size !== 0) {
    ctx.warning('ignoring parameters')
  }
  return Maybe.some(token)
}

function reportHeaderErrors(ctx: Context, v: Item | InnerList): Maybe<boolean> {
  if (typeof v[0] !== 'boolean') {
    ctx.error('must be a boolean')
    return Maybe.None
  }
  if (v[1].size !== 0) {
    ctx.warning('ignoring parameters')
  }
  return Maybe.some(v[0])
}

export function validateInfo(str: string): [ValidationResult, Maybe<Info>] {
  return validateDictionary(new Context(), str, (ctx, d) =>
    struct(ctx, d, {
      preferredPlatform: field('preferred-platform', preferredPlatform, null),
      reportHeaderErrors: field(
        'report-header-errors',
        reportHeaderErrors,
        false
      ),
    })
  )
}

export function serializeInfo(info: Info): string {
  const map: Dictionary = new Map()
  if (info.preferredPlatform !== null) {
    map.set('preferred-platform', [info.preferredPlatform, new Map()])
  }
  map.set('report-header-errors', [info.reportHeaderErrors, new Map()])
  return serializeDictionary(map)
}
