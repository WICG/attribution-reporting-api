import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { CtxFunc } from './validate'
import * as validate from './validate'
import {
  Dictionary,
  InnerList,
  Item,
  parseDictionary,
} from 'structured-headers'

export const { field, struct } = validate.make<Dictionary, Item | InnerList>(
  /*getAndDelete=*/ (d, name) => {
    const v = d.get(name)
    d.delete(name)
    return v
  },
  /*unknownKeys=*/ (d) => d.keys(),
  /*warnUnknownMsg=*/ 'unknown dictionary key'
)

export function validateDictionary<T extends Object, C extends Context>(
  ctx: C,
  str: string,
  f: CtxFunc<C, Dictionary, Maybe<T>>
): [ValidationResult, Maybe<T>] {
  let d
  try {
    d = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), Maybe.None]
  }

  const v = f(ctx, d)
  return [ctx.finish(), v]
}
