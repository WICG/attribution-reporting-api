import * as constants from '../constants'
import { VendorSpecificValues } from '../vendor-specific-values'
import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  AggregatableDebugReportingConfig,
  AggregatableDebugReportingData,
  AggregationCoordinatorOrigin,
  CommonDebug,
  KeyPiece,
  Priority,
} from './reg'
import {
  CtxFunc,
  ItemErrorAction,
  LengthOpts,
  isInteger,
  isInRange,
  isLengthValid,
  matchesPattern,
  required,
  suitableOrigin,
  withDefault,
} from './validate'
import * as validate from './validate'

const { None, some } = Maybe

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uintRegex = /^[0-9]+$/
const intRegex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

export const UINT32_MAX: number = 2 ** 32 - 1

export interface RegistrationOptions {
  vsv: VendorSpecificValues
  fullFlex?: boolean | undefined
  namedBudgets?: boolean | undefined
}

export class RegistrationContext<
  Opts extends RegistrationOptions = RegistrationOptions,
> extends Context {
  constructor(
    readonly opts: Readonly<Opts>,
    readonly aggregatableDebugTypes: Readonly<[string, ...string[]]>
  ) {
    super()
  }
}

const {
  exclusive,
  field,
  struct: structInternal,
} = validate.make<JsonDict, Json>(
  /*getAndDelete=*/ (d, name) => {
    const v = d[name]
    delete d[name]
    return v
  },
  /*unknownKeys=*/ (d) => Object.keys(d),
  /*warnUnknownMsg=*/ 'unknown field'
)

export { exclusive, field }

export type StructFields<
  T extends object,
  C extends Context = Context,
> = validate.StructFields<T, JsonDict, C>

export function struct<T extends object, C extends Context>(
  d: Json,
  ctx: C,
  fields: StructFields<T, C>,
  warnUnknown: boolean = true
): Maybe<T> {
  return object(d, ctx).flatMap(structInternal, ctx, fields, warnUnknown)
}

export type TypeSwitch<T, C extends Context = Context> = {
  boolean?: CtxFunc<C, boolean, Maybe<T>>
  number?: CtxFunc<C, number, Maybe<T>>
  string?: CtxFunc<C, string, Maybe<T>>
  list?: CtxFunc<C, Json[], Maybe<T>>
  object?: CtxFunc<C, JsonDict, Maybe<T>>
}

export function typeSwitch<T, C extends Context = Context>(
  j: Json,
  ctx: C,
  ts: TypeSwitch<T, C>
): Maybe<T> {
  if (typeof j === 'boolean' && ts.boolean !== undefined) {
    return ts.boolean(j, ctx)
  }
  if (typeof j === 'number' && ts.number !== undefined) {
    return ts.number(j, ctx)
  }
  if (typeof j === 'string' && ts.string !== undefined) {
    return ts.string(j, ctx)
  }
  if (Array.isArray(j) && ts.list !== undefined) {
    return ts.list(j, ctx)
  }
  if (isObject(j) && ts.object !== undefined) {
    return ts.object(j, ctx)
  }

  const allowed = Object.keys(ts)
    .map((t) => `${t === 'object' ? 'an' : 'a'} ${t}`)
    .join(' or ')
  ctx.error(`must be ${allowed}`)
  return None
}

export function string(j: Json, ctx: Context): Maybe<string> {
  return typeSwitch(j, ctx, { string: some })
}

export function bool(j: Json, ctx: Context): Maybe<boolean> {
  return typeSwitch(j, ctx, { boolean: some })
}

function isObject(j: Json): j is JsonDict {
  return j !== null && typeof j === 'object' && j.constructor === Object
}

export function object(j: Json, ctx: Context): Maybe<JsonDict> {
  return typeSwitch(j, ctx, { object: some })
}

export function keyValues<V, C extends Context = Context>(
  j: Json,
  ctx: C,
  f: CtxFunc<C, [key: string, val: Json], Maybe<V>>,
  maxKeys: number = Infinity
): Maybe<Map<string, V>> {
  return object(j, ctx).flatMap((d) => {
    const entries = Object.entries(d)

    if (entries.length > maxKeys) {
      ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
      return None
    }

    return validate.keyValues(entries, ctx, f)
  })
}

export function list(j: Json, ctx: Context): Maybe<Json[]> {
  return typeSwitch(j, ctx, { list: some })
}

export function uint(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(
      matchesPattern,
      ctx,
      uintRegex,
      'string must represent a non-negative integer'
    )
    .map(BigInt)
}

export function uint64(j: Json, ctx: Context): Maybe<bigint> {
  return uint(j, ctx).filter(
    isInRange,
    ctx,
    0n,
    2n ** 64n - 1n,
    'must fit in an unsigned 64-bit integer'
  )
}

export function number(j: Json, ctx: Context): Maybe<number> {
  return typeSwitch(j, ctx, { number: some })
}

export function nonNegativeInteger(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 0, Infinity, 'must be non-negative')
}

export function positiveInteger(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, Infinity, 'must be positive')
}

export function int64(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(matchesPattern, ctx, intRegex, 'string must represent an integer')
    .map(BigInt)
    .filter(
      isInRange,
      ctx,
      (-2n) ** (64n - 1n),
      2n ** (64n - 1n) - 1n,
      'must fit in a signed 64-bit integer'
    )
}

export function hex128(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(matchesPattern, ctx, hex128Regex, 'must be a hex128')
    .map(BigInt)
}

export type SetOpts = LengthOpts & {
  requireDistinct?: boolean
}

export function set<T extends number | string, C extends Context = Context>(
  j: Json,
  ctx: C,
  f: CtxFunc<C, Json, Maybe<T>>,
  opts?: SetOpts
): Maybe<Set<T>> {
  return list(j, ctx)
    .flatMap((js) => validate.set(js.entries(), ctx, f, opts?.requireDistinct))
    .filter((set) => isLengthValid(set.size, ctx, opts))
}

export type ArrayOpts = LengthOpts & {
  itemErrorAction?: ItemErrorAction
}

export function array<T, C extends Context = Context>(
  j: Json,
  ctx: C,
  f: CtxFunc<C, Json, Maybe<T>>,
  opts?: ArrayOpts
): Maybe<T[]> {
  return list(j, ctx)
    .filter((js) => isLengthValid(js.length, ctx, opts))
    .flatMap((js) =>
      validate.array(js.entries(), ctx, f, opts?.itemErrorAction)
    )
}

export const commonDebugFields: StructFields<CommonDebug> = {
  debugKey: field('debug_key', withDefault(uint64, null)),
  debugReporting: field('debug_reporting', withDefault(bool, false)),
}

export const priorityField: StructFields<Priority> = {
  priority: field('priority', withDefault(int64, 0n)),
}

function aggregatableDebugType(
  j: Json,
  ctx: RegistrationContext
): Maybe<string> {
  return string(j, ctx).peek((s) => {
    if (!ctx.aggregatableDebugTypes.includes(s)) {
      ctx.warning('unknown type')
    }
  })
}

export const keyPieceField: StructFields<KeyPiece> = {
  keyPiece: field('key_piece', required(hex128)),
}

function aggregatableDebugReportingData(
  j: Json,
  ctx: RegistrationContext
): Maybe<AggregatableDebugReportingData> {
  return struct(j, ctx, {
    types: field('types', required(set), aggregatableDebugType, {
      minLength: 1,
      requireDistinct: true,
    }),
    value: field('value', required(aggregatableKeyValueValue)),
    ...keyPieceField,
  })
}

function aggregatableDebugReportingDataList(
  j: Json,
  ctx: RegistrationContext
): Maybe<AggregatableDebugReportingData[]> {
  return array(j, ctx, aggregatableDebugReportingData).filter((data) => {
    const types = new Set<string>()
    const dups = new Set<string>()
    for (const d of data) {
      for (const t of d.types) {
        if (types.has(t)) {
          dups.add(t)
        } else {
          types.add(t)
        }
      }
    }
    if (dups.size > 0) {
      ctx.error(`duplicate type: ${Array.from(dups).join(', ')}`)
      return false
    }
    return true
  })
}

export const aggregationCoordinatorOriginField: StructFields<
  AggregationCoordinatorOrigin,
  RegistrationContext
> = {
  aggregationCoordinatorOrigin: field(
    'aggregation_coordinator_origin',
    aggregationCoordinatorOrigin
  ),
}

export const aggregatableDebugReportingConfig: StructFields<
  AggregatableDebugReportingConfig,
  RegistrationContext
> = {
  debugData: field(
    'debug_data',
    withDefault(aggregatableDebugReportingDataList, [])
  ),

  ...aggregationCoordinatorOriginField,
  ...keyPieceField,
}

export function aggregationKeyIdentifierLength(
  s: string,
  ctx: Context,
  errPrefix: string = ''
): boolean {
  if (s.length > constants.maxLengthPerAggregationKeyIdentifier) {
    ctx.error(
      `${errPrefix}exceeds max length per aggregation key identifier (${s.length} > ${constants.maxLengthPerAggregationKeyIdentifier})`
    )
    return false
  }
  return true
}

export function aggregatableKeyValueValue(
  j: Json,
  ctx: Context
): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, constants.allowedAggregatableBudgetPerSource)
}

export function enumerated<T>(
  j: Json,
  ctx: Context,
  e: Record<string, T>
): Maybe<T> {
  return string(j, ctx).flatMap(validate.enumerated, ctx, e)
}

export function positiveUint32(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, UINT32_MAX)
}

function aggregationCoordinatorOrigin(
  j: Json | undefined,
  ctx: RegistrationContext
): Maybe<string> {
  return j === undefined
    ? some(ctx.opts.vsv.aggregationCoordinatorOrigins[0])
    : string(j, ctx)
        .flatMap(suitableOrigin, ctx)
        .filter((s) => {
          if (!ctx.opts.vsv.aggregationCoordinatorOrigins.includes(s)) {
            const allowed =
              ctx.opts.vsv.aggregationCoordinatorOrigins.join(', ')
            ctx.error(`must be one of the following: ${allowed}`)
            return false
          }
          return true
        })
}

export function validateJSON<T, C extends Context = Context>(
  ctx: C,
  json: string,
  f: CtxFunc<C, Json, Maybe<T>>
): [ValidationResult, Maybe<T>] {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), None]
  }

  const v = f(value as Json, ctx)
  return [ctx.finish(), v]
}
