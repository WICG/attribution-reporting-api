import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import * as validate from './validate'
import { field, struct, validateDictionary } from './validate-structured'
import {
  Dictionary,
  InnerList,
  Item,
  Token,
  serializeDictionary,
} from 'structured-headers'

export enum PreferredPlatform {
  os = 'os',
  web = 'web',
}

export type Info = {
  preferredPlatform: PreferredPlatform | null
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
  return validate
    .enumerated(ctx, v[0].toString(), PreferredPlatform)
    .peek((_) => {
      if (v[1].size !== 0) {
        ctx.warning('ignoring parameters')
      }
    })
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
