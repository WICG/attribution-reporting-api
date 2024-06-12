import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import { CtxFunc } from './validate'
import * as validate from './validate'
import {
  BareItem,
  Dictionary,
  InnerList,
  Item,
  Parameters,
  parseDictionary,
} from 'structured-headers'

function getAndDelete<V>(m: Map<string, V>, name: string): V | undefined {
  const v = m.get(name)
  m.delete(name)
  return v
}

export const { field, struct } = validate.make<Dictionary, Item | InnerList>(
  getAndDelete,
  /*unknownKeys=*/ (d) => d.keys(),
  /*warnUnknownMsg=*/ 'unknown dictionary key'
)

export const param = validate.make<Parameters, BareItem>(
  getAndDelete,
  /*unknownKeys=*/ (d) => d.keys(),
  /*warnUnknownMsg=*/ 'unknown parameter'
)

export function validateDictionary<T, C extends Context>(
  str: string,
  ctx: C,
  f: CtxFunc<C, Dictionary, Maybe<T>>
): [ValidationResult, Maybe<T>] {
  let d
  try {
    d = parseDictionary(str)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), Maybe.None]
  }

  const v = f(d, ctx)
  return [ctx.finish(), v]
}
