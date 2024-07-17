import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { enumerated } from './validate'
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
  v: Item | InnerList | undefined,
  ctx: Context
): Maybe<PreferredPlatform | null> {
  if (v === undefined) {
    return Maybe.some(null)
  }
  if (!(v[0] instanceof Token)) {
    ctx.error('must be a token')
    return Maybe.None
  }
  return enumerated(v[0].toString(), ctx, PreferredPlatform).peek(() => {
    if (v[1].size !== 0) {
      ctx.warning('ignoring parameters')
    }
  })
}

function reportHeaderErrors(
  v: Item | InnerList | undefined,
  ctx: Context
): Maybe<boolean> {
  if (v === undefined) {
    return Maybe.some(false)
  }
  if (typeof v[0] !== 'boolean') {
    ctx.error('must be a boolean')
    return Maybe.None
  }
  if (v[1].size !== 0) {
    ctx.warning('ignoring parameters')
  }
  return Maybe.some(v[0])
}

export function validate(str: string): [ValidationResult, Maybe<Info>] {
  return validateDictionary(str, new Context(), (d, ctx) =>
    struct(d, ctx, {
      preferredPlatform: field('preferred-platform', preferredPlatform),
      reportHeaderErrors: field('report-header-errors', reportHeaderErrors),
    })
  )
}

export function serialize(info: Info): string {
  const map: Dictionary = new Map()
  if (info.preferredPlatform !== null) {
    map.set('preferred-platform', [info.preferredPlatform, new Map()])
  }
  map.set('report-header-errors', [info.reportHeaderErrors, new Map()])
  return serializeDictionary(map)
}
