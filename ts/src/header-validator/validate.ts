import { Context, PathComponent } from './context'
import { Maybe, Maybeable } from './maybe'

export type CtxFunc<C extends Context, I, O> = (ctx: C, i: I) => O

export type StructFields<T extends object, D, C extends Context = Context> = {
  [K in keyof T]-?: CtxFunc<C, D, Maybe<T[K]>>
}

type StructFunc<D> = <T extends object, C extends Context>(
  ctx: C,
  d: D,
  fields: StructFields<T, D, C>,
  warnUnknown?: boolean
) => Maybe<T>

function struct<D>(
  unknownKeys: (d: D) => Iterable<string>,
  warnUnknownMsg: string
): StructFunc<D> {
  return <T extends object, C extends Context>(
    ctx: C,
    d: D,
    fields: StructFields<T, D, C>,
    warnUnknown = true
  ) => {
    const t: Partial<T> = {}

    let ok = true
    for (const prop in fields) {
      let itemOk = false
      fields[prop](ctx, d).peek((v) => {
        itemOk = true
        t[prop] = v
      })
      ok = ok && itemOk
    }

    if (warnUnknown) {
      for (const key of unknownKeys(d)) {
        ctx.scope(key, () => ctx.warning(warnUnknownMsg))
      }
    }

    return ok ? Maybe.some(t as T) : Maybe.None
  }
}

type GetAndDeleteFunc<D, V> = (d: D, name: string) => V | undefined

type FieldFunc<D, V> = <T, C extends Context>(
  name: string,
  f: CtxFunc<C, V, Maybe<T>>,
  valueIfAbsent?: Maybeable<T>
) => CtxFunc<C, D, Maybe<T>>

function field<D, V>(getAndDelete: GetAndDeleteFunc<D, V>): FieldFunc<D, V> {
  return <T, C extends Context>(
      name: string,
      f: CtxFunc<C, V, Maybe<T>>,
      valueIfAbsent?: Maybeable<T>
    ) =>
    (ctx: C, d: D): Maybe<T> =>
      ctx.scope(name, () => {
        const v = getAndDelete(d, name)
        if (v === undefined) {
          if (valueIfAbsent === undefined) {
            ctx.error('required')
            return Maybe.None
          }
          return Maybe.flatten(valueIfAbsent)
        }
        return f(ctx, v)
      })
}

export type Exclusive<T, V, C extends Context> = {
  [key: string]: CtxFunc<C, V, Maybe<T>>
}

type ExclusiveFunc<D, V> = <T, C extends Context>(
  x: Exclusive<T, V, C>,
  valueIfAbsent: Maybeable<T>
) => CtxFunc<C, D, Maybe<T>>

function exclusive<D, V>(
  getAndDelete: GetAndDeleteFunc<D, V>
): ExclusiveFunc<D, V> {
  return <T, C extends Context>(
      x: Exclusive<T, V, C>,
      valueIfAbsent: Maybeable<T>
    ) =>
    (ctx: C, d: D): Maybe<T> => {
      const found: string[] = []
      let v: Maybe<T> = Maybe.None

      for (const [key, f] of Object.entries(x)) {
        const j = getAndDelete(d, key)
        if (j !== undefined) {
          found.push(key)
          v = ctx.scope(key, () => f(ctx, j))
        }
      }

      if (found.length === 1) {
        return v
      }

      if (found.length > 1) {
        ctx.error(`mutually exclusive fields: ${found.join(', ')}`)
        return Maybe.None
      }

      return Maybe.flatten(valueIfAbsent)
    }
}

type Funcs<D, V> = {
  exclusive: ExclusiveFunc<D, V>
  field: FieldFunc<D, V>
  struct: StructFunc<D>
}

export function make<D, V>(
  getAndDelete: GetAndDeleteFunc<D, V>,
  unknownKeys: (d: D) => Iterable<string>,
  warnUnknownMsg: string
): Funcs<D, V> {
  return {
    exclusive: exclusive(getAndDelete),
    field: field(getAndDelete),
    struct: struct(unknownKeys, warnUnknownMsg),
  }
}

export enum ItemErrorAction {
  ignore,
  reportButKeepGoing,
  earlyExit,
}

export function isCollection<
  P extends PathComponent,
  V,
  C extends Context = Context,
>(
  ctx: C,
  vs: Iterable<[P, V]>,
  f: CtxFunc<C, [P, V], Maybe<unknown>>,
  itemErrorAction: ItemErrorAction = ItemErrorAction.reportButKeepGoing
): boolean {
  let ok = true
  for (const [c, v] of vs) {
    let itemOk = false
    ctx.scope(c, () => f(ctx, [c, v]).peek(() => (itemOk = true)))
    if (!itemOk) {
      if (itemErrorAction === ItemErrorAction.earlyExit) {
        return false
      }
      if (itemErrorAction === ItemErrorAction.reportButKeepGoing) {
        ok = false
      }
    }
  }
  return ok
}

export function array<T, V, C extends Context = Context>(
  ctx: C,
  vs: Iterable<[number, V]>,
  f: CtxFunc<C, V, Maybe<T>>,
  itemErrorAction: ItemErrorAction = ItemErrorAction.reportButKeepGoing
): Maybe<T[]> {
  const arr: T[] = []

  if (
    !isCollection(
      ctx,
      vs,
      (ctx, [_i, v]) => f(ctx, v).peek((v) => arr.push(v)),
      itemErrorAction
    )
  ) {
    return Maybe.None
  }
  return Maybe.some(arr)
}
