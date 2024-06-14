import * as psl from 'psl'
import { Context, PathComponent } from './context'
import { Maybe } from './maybe'

export type CtxFunc<C extends Context, I, O> = (i: I, ctx: C) => O

export type StructFields<T extends object, D, C extends Context = Context> = {
  [K in keyof T]-?: CtxFunc<C, D, Maybe<T[K]>>
}

type StructFunc<D> = <T extends object, C extends Context>(
  d: D,
  ctx: C,
  fields: StructFields<T, D, C>,
  warnUnknown?: boolean
) => Maybe<T>

function struct<D>(
  unknownKeys: (d: D) => Iterable<string>,
  warnUnknownMsg: string
): StructFunc<D> {
  return <T extends object, C extends Context>(
    d: D,
    ctx: C,
    fields: StructFields<T, D, C>,
    warnUnknown = true
  ) => {
    const t: Partial<T> = {}

    let ok = true
    for (const prop in fields) {
      let itemOk = false
      fields[prop](d, ctx).peek((v) => {
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
  valueIfAbsent?: T
) => CtxFunc<C, D, Maybe<T>>

function field<D, V>(getAndDelete: GetAndDeleteFunc<D, V>): FieldFunc<D, V> {
  return <T, C extends Context>(
      name: string,
      f: CtxFunc<C, V, Maybe<T>>,
      valueIfAbsent?: T
    ) =>
    (d: D, ctx: C): Maybe<T> =>
      ctx.scope(name, () => {
        const v = getAndDelete(d, name)
        if (v === undefined) {
          if (valueIfAbsent === undefined) {
            ctx.error('required')
            return Maybe.None
          }
          return Maybe.some(valueIfAbsent)
        }
        return f(v, ctx)
      })
}

type FieldMaybeDefaultFunc<D, V> = <T, C extends Context>(
  name: string,
  f: CtxFunc<C, V, Maybe<T>>,
  valueIfAbsent: Maybe<T>
) => CtxFunc<C, D, Maybe<T>>

// TODO(apaseltiner): Merge this function back into `field` since it is
// identical other than whether the default value is T or Maybe<T>.
function fieldMaybeDefault<D, V>(
  getAndDelete: GetAndDeleteFunc<D, V>
): FieldMaybeDefaultFunc<D, V> {
  return <T, C extends Context>(
      name: string,
      f: CtxFunc<C, V, Maybe<T>>,
      valueIfAbsent: Maybe<T>
    ) =>
    (d: D, ctx: C): Maybe<T> =>
      ctx.scope(name, () => {
        const v = getAndDelete(d, name)
        if (v === undefined) {
          return valueIfAbsent
        }
        return f(v, ctx)
      })
}

export type Exclusive<T, V, C extends Context> = {
  [key: string]: CtxFunc<C, V, Maybe<T>>
}

type ExclusiveFunc<D, V> = <T, C extends Context>(
  x: Exclusive<T, V, C>,
  valueIfAbsent: Maybe<T>
) => CtxFunc<C, D, Maybe<T>>

function exclusive<D, V>(
  getAndDelete: GetAndDeleteFunc<D, V>
): ExclusiveFunc<D, V> {
  return <T, C extends Context>(
      x: Exclusive<T, V, C>,
      valueIfAbsent: Maybe<T>
    ) =>
    (d: D, ctx: C): Maybe<T> => {
      const found: string[] = []
      let v: Maybe<T> = Maybe.None

      for (const [key, f] of Object.entries(x)) {
        const j = getAndDelete(d, key)
        if (j !== undefined) {
          found.push(key)
          v = ctx.scope(key, () => f(j, ctx))
        }
      }

      if (found.length === 1) {
        return v
      }

      if (found.length > 1) {
        ctx.error(`mutually exclusive fields: ${found.join(', ')}`)
        return Maybe.None
      }

      return valueIfAbsent
    }
}

type Funcs<D, V> = {
  exclusive: ExclusiveFunc<D, V>
  field: FieldFunc<D, V>
  fieldMaybeDefault: FieldMaybeDefaultFunc<D, V>
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
    fieldMaybeDefault: fieldMaybeDefault(getAndDelete),
    struct: struct(unknownKeys, warnUnknownMsg),
  }
}

export enum ItemErrorAction {
  ignore,
  reportButKeepGoing,
  earlyExit,
}

function makeCollection<Col, P extends PathComponent, V, C extends Context>(
  out: Col,
  vs: Iterable<[P, V]>,
  ctx: C,
  f: (out: Col, v: V, p: P) => Maybe<unknown>,
  itemErrorAction: ItemErrorAction = ItemErrorAction.reportButKeepGoing
): Maybe<Col> {
  let ok = true
  for (const [p, v] of vs) {
    const itemOk = ctx.scope(p, () => f(out, v, p).value !== undefined)
    if (!itemOk) {
      if (itemErrorAction === ItemErrorAction.earlyExit) {
        return Maybe.None
      }
      if (itemErrorAction === ItemErrorAction.reportButKeepGoing) {
        ok = false
      }
    }
  }
  return ok ? Maybe.some(out) : Maybe.None
}

export function array<T, V, C extends Context = Context>(
  vs: Iterable<[number, V]>,
  ctx: C,
  f: CtxFunc<C, V, Maybe<T>>,
  itemErrorAction: ItemErrorAction = ItemErrorAction.reportButKeepGoing
): Maybe<T[]> {
  return makeCollection(
    new Array<T>(),
    vs,
    ctx,
    (arr, v) => f(v, ctx).peek((v) => arr.push(v)),
    itemErrorAction
  )
}

export function set<T extends number | string, V, C extends Context = Context>(
  vs: Iterable<[number, V]>,
  ctx: C,
  f: CtxFunc<C, V, Maybe<T>>,
  requireDistinct: boolean = false
): Maybe<Set<T>> {
  return makeCollection(new Set<T>(), vs, ctx, (set, v) =>
    f(v, ctx).filter((v) => {
      if (set.has(v)) {
        const msg = `duplicate value ${v}`
        if (requireDistinct) {
          ctx.error(msg)
          return false
        }
        ctx.warning(msg)
      } else {
        set.add(v)
      }
      return true
    })
  )
}

export function keyValues<T, V, C extends Context = Context>(
  vs: Iterable<[string, V]>,
  ctx: C,
  f: CtxFunc<C, [string, V], Maybe<T>>
): Maybe<Map<string, T>> {
  return makeCollection(new Map<string, T>(), vs, ctx, (map, v, key) =>
    f([key, v], ctx).peek((v) => map.set(key, v))
  )
}

export function enumerated<T>(
  s: string,
  ctx: Context,
  e: Record<string, T>
): Maybe<T> {
  const v = e[s]
  if (v !== undefined) {
    return Maybe.some(v)
  }
  const allowed = Object.keys(e).join(', ')
  ctx.error(`must be one of the following (case-sensitive): ${allowed}`)
  return Maybe.None
}

export function matchesPattern(
  s: string,
  ctx: Context,
  p: RegExp,
  errPrefix: string
): boolean {
  if (!p.test(s)) {
    ctx.error(`${errPrefix} (must match ${p})`)
    return false
  }
  return true
}

export function isInteger(n: number, ctx: Context): boolean {
  if (!Number.isInteger(n)) {
    ctx.error('must be an integer')
    return false
  }
  return true
}

export function isInRange<N extends bigint | number>(
  n: N,
  ctx: Context,
  min: N,
  max: N,
  msg: string = `must be in the range [${min}, ${max}]`
): boolean {
  if (n < min || n > max) {
    ctx.error(msg)
    return false
  }
  return true
}

export function clamp<N extends bigint | number>(
  n: N,
  ctx: Context,
  min: N,
  max: N,
  maxSuffix: string = ''
): N {
  if (n < min) {
    ctx.warning(`will be clamped to min of ${min}`)
    return min
  }
  if (n > max) {
    ctx.warning(`will be clamped to max of ${max}${maxSuffix}`)
    return max
  }
  return n
}

export type LengthOpts = {
  minLength?: number
  maxLength?: number
  maxLengthErrSuffix?: string
}

export function isLengthValid(
  length: number,
  ctx: Context,
  {
    minLength = 0,
    maxLength = Infinity,
    maxLengthErrSuffix = '',
  }: LengthOpts = {}
): boolean {
  if (length > maxLength || length < minLength) {
    ctx.error(
      `length must be in the range [${minLength}, ${maxLength}${maxLengthErrSuffix}]`
    )
    return false
  }
  return true
}

function suitableScope(
  s: string,
  ctx: Context,
  label: string,
  scope: (url: URL) => string,
  rejectExtraComponents: boolean
): Maybe<string> {
  let url
  try {
    url = new URL(s)
  } catch {
    ctx.error('invalid URL')
    return Maybe.None
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    ctx.error('URL must use HTTP/HTTPS and be potentially trustworthy')
    return Maybe.None
  }

  const scoped = scope(url)
  if (url.toString() !== new URL(scoped).toString()) {
    if (rejectExtraComponents) {
      ctx.error(
        `must not contain URL components other than ${label} (${scoped})`
      )
      return Maybe.None
    }
    ctx.warning(
      `URL components other than ${label} (${scoped}) will be ignored`
    )
  }
  return Maybe.some(scoped)
}

export function suitableOrigin(
  s: string,
  ctx: Context,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return suitableScope(s, ctx, 'origin', (u) => u.origin, rejectExtraComponents)
}

export function suitableSite(
  s: string,
  ctx: Context,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return suitableScope(
    s,
    ctx,
    'site',
    (u) => `${u.protocol}//${psl.get(u.hostname)}`,
    rejectExtraComponents
  )
}
