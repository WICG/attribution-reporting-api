import * as uuid from 'uuid'
import * as constants from '../constants'
import { SourceType } from '../source-type'
import { VendorSpecificValues } from '../vendor-specific-values'
import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  CtxFunc,
  ItemErrorAction,
  LengthOpts,
  clamp,
  isInteger,
  isInRange,
  isLengthValid,
  matchesPattern,
  required,
  suitableOrigin,
  suitableSite,
  withDefault,
} from './validate'
import * as validate from './validate'
import * as privacy from '../flexible-event/privacy'

const { None, some } = Maybe

export type JsonDict = { [key: string]: Json }
export type Json = null | boolean | number | string | Json[] | JsonDict

const uintRegex = /^[0-9]+$/
const intRegex = /^-?[0-9]+$/
const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/

const UINT32_MAX: number = 2 ** 32 - 1

class GenericContext extends Context {
  constructor(readonly parseFullFlex: boolean) {
    super()
  }
}

class RegistrationContext extends GenericContext {
  constructor(
    readonly vsv: Readonly<VendorSpecificValues>,
    parseFullFlex: boolean,
    readonly aggregatableDebugTypes: Readonly<[string, ...string[]]>,
    readonly parseScopes: boolean
  ) {
    super(parseFullFlex)
  }

  isDebugTypeSupported(s: string): boolean {
    return this.aggregatableDebugTypes.includes(s)
  }
}

class SourceContext extends RegistrationContext {
  constructor(
    vsv: VendorSpecificValues,
    parseFullFlex: boolean,
    readonly sourceType: SourceType,
    readonly noteInfoGain: boolean,
    parseScopes: boolean
  ) {
    super(
      vsv,
      parseFullFlex,
      constants.sourceAggregatableDebugTypes,
      parseScopes
    )
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

type StructFields<
  T extends object,
  C extends Context = Context,
> = validate.StructFields<T, JsonDict, C>

function struct<T extends object, C extends Context>(
  d: Json,
  ctx: C,
  fields: StructFields<T, C>,
  warnUnknown: boolean = true
): Maybe<T> {
  return object(d, ctx).flatMap(structInternal, ctx, fields, warnUnknown)
}

type TypeSwitch<T, C extends Context = Context> = {
  boolean?: CtxFunc<C, boolean, Maybe<T>>
  number?: CtxFunc<C, number, Maybe<T>>
  string?: CtxFunc<C, string, Maybe<T>>
  list?: CtxFunc<C, Json[], Maybe<T>>
  object?: CtxFunc<C, JsonDict, Maybe<T>>
}

function typeSwitch<T, C extends Context = Context>(
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

function string(j: Json, ctx: Context): Maybe<string> {
  return typeSwitch(j, ctx, { string: some })
}

function bool(j: Json, ctx: Context): Maybe<boolean> {
  return typeSwitch(j, ctx, { boolean: some })
}

function isObject(j: Json): j is JsonDict {
  return j !== null && typeof j === 'object' && j.constructor === Object
}

function object(j: Json, ctx: Context): Maybe<JsonDict> {
  return typeSwitch(j, ctx, { object: some })
}

function keyValues<V, C extends Context = Context>(
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

function list(j: Json, ctx: Context): Maybe<Json[]> {
  return typeSwitch(j, ctx, { list: some })
}

function uint(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(
      matchesPattern,
      ctx,
      uintRegex,
      'string must represent a non-negative integer'
    )
    .map(BigInt)
}

function uint64(j: Json, ctx: Context): Maybe<bigint> {
  return uint(j, ctx).filter(
    isInRange,
    ctx,
    0n,
    2n ** 64n - 1n,
    'must fit in an unsigned 64-bit integer'
  )
}

function number(j: Json, ctx: Context): Maybe<number> {
  return typeSwitch(j, ctx, { number: some })
}

function nonNegativeInteger(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 0, Infinity, 'must be non-negative')
}

function positiveInteger(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, Infinity, 'must be positive')
}

function int64(j: Json, ctx: Context): Maybe<bigint> {
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

function hex128(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(matchesPattern, ctx, hex128Regex, 'must be a hex128')
    .map(BigInt)
}

function destination(j: Json, ctx: Context): Maybe<Set<string>> {
  return typeSwitch(j, ctx, {
    string: (j) => suitableSite(j, ctx).map((s) => new Set([s])),
    list: (j) =>
      set(j, ctx, (j) => string(j, ctx).flatMap(suitableSite, ctx), {
        minLength: 1,
        maxLength: 3,
      }),
  })
}

function maxEventLevelReports(
  j: Json | undefined,
  ctx: SourceContext
): Maybe<number> {
  return j === undefined
    ? some(constants.defaultEventLevelAttributionsPerSource[ctx.sourceType])
    : number(j, ctx)
        .filter(isInteger, ctx)
        .filter(
          isInRange,
          ctx,
          0,
          constants.maxSettableEventLevelAttributionsPerSource
        )
}

function startTime(
  j: Json,
  ctx: Context,
  expiry: Maybe<number>
): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter((n) => {
      if (expiry.value === undefined) {
        ctx.error('cannot be fully validated without a valid expiry')
        return false
      }
      return isInRange(
        n,
        ctx,
        0,
        expiry.value,
        `must be non-negative and <= expiry (${expiry.value})`
      )
    })
}

function endTimes(
  j: Json,
  ctx: Context,
  expiry: Maybe<number>,
  startTime: Maybe<number>
): Maybe<number[]> {
  if (startTime.value === undefined) {
    ctx.error('cannot be fully validated without a valid start_time')
    return None
  }

  if (expiry.value === undefined) {
    ctx.error('cannot be fully validated without a valid expiry')
    return None
  }

  let prev = startTime.value
  let prevDesc = 'start_time'

  const endTime = (j: Json): Maybe<number> =>
    positiveInteger(j, ctx)
      .map(clamp, ctx, constants.minReportWindow, expiry.value!, ' (expiry)')
      .filter(
        isInRange,
        ctx,
        prev + 1,
        Infinity,
        `must be > ${prevDesc} (${prev})`
      )
      .peek((n) => {
        prev = n
        prevDesc = 'previous end_time'
      })

  return array(j, ctx, endTime, {
    minLength: 1,
    maxLength: 5,
    itemErrorAction: ItemErrorAction.earlyExit, // suppress unhelpful cascaded errors
  })
}

export type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

function eventReportWindows(
  j: Json,
  ctx: SourceContext,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return object(j, ctx).flatMap((j) => {
    const startTimeValue = field(
      'start_time',
      withDefault(startTime, 0),
      expiry
    )(j, ctx)

    return struct(j, ctx, {
      startTime: () => startTimeValue,
      endTimes: field('end_times', required(endTimes), expiry, startTimeValue),
    })
  })
}

function legacyDuration(j: Json, ctx: Context): Maybe<number | bigint> {
  return typeSwitch<number | bigint>(j, ctx, {
    number: nonNegativeInteger,
    string: uint64,
  })
}

type SetOpts = LengthOpts & {
  requireDistinct?: boolean
}

function set<T extends number | string, C extends Context = Context>(
  j: Json,
  ctx: C,
  f: CtxFunc<C, Json, Maybe<T>>,
  opts?: SetOpts
): Maybe<Set<T>> {
  // TODO(https://github.com/WICG/attribution-reporting-api/issues/1321): Size
  // checks should be performed on the resulting set, not on the list.
  return list(j, ctx)
    .filter((js) => isLengthValid(js.length, ctx, opts))
    .flatMap((js) => validate.set(js.entries(), ctx, f, opts?.requireDistinct))
}

type ArrayOpts = LengthOpts & {
  itemErrorAction?: ItemErrorAction
}

function array<T, C extends Context = Context>(
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

function filterDataKeyValue(
  [key, j]: [string, Json],
  ctx: Context
): Maybe<Set<string>> {
  if (key === 'source_type' || key === '_lookback_window') {
    ctx.error('is prohibited because it is implicitly set')
    return None
  }
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return None
  }

  const filterStringLength = (s: string, errorPrefix: string = '') => {
    if (s.length > constants.maxLengthPerFilterString) {
      ctx.error(
        `${errorPrefix}exceeds max length per filter string (${s.length} > ${constants.maxLengthPerFilterString})`
      )
      return false
    }
    return true
  }

  if (!filterStringLength(key, 'key ')) {
    return None
  }

  return set(j, ctx, (j) => string(j, ctx).filter(filterStringLength), {
    maxLength: constants.maxValuesPerFilterDataEntry,
  })
}

export type FilterData = Map<string, Set<string>>

export function filterData(j: Json, ctx: Context): Maybe<FilterData> {
  return keyValues(
    j,
    ctx,
    filterDataKeyValue,
    constants.maxEntriesPerFilterData
  )
}

function filterKeyValue(
  [key, j]: [string, Json],
  ctx: Context
): Maybe<Set<string>> {
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return None
  }

  const peek =
    key === 'source_type'
      ? (s: string) => {
          if (!(s in SourceType)) {
            const allowed = Object.keys(SourceType).join(', ')
            ctx.warning(
              `unknown value ${s} (${key} can only match one of ${allowed})`
            )
          }
        }
      : () => {}

  return set(j, ctx, (j) => string(j, ctx).peek(peek))
}

export type FilterConfig = {
  lookbackWindow: number | null
  map: Map<string, Set<string>>
}

function filterConfig(j: Json, ctx: Context): Maybe<FilterConfig> {
  // `lookbackWindow` must come before `map` to ensure it is processed first.
  return struct(
    j,
    ctx,
    {
      lookbackWindow: field(
        '_lookback_window',
        withDefault(positiveInteger, null)
      ),
      map: (j) => keyValues(j, ctx, filterKeyValue),
    },
    /*warnUnknown=*/ false
  )
}

function orFilters(j: Json, ctx: Context): Maybe<FilterConfig[]> {
  return typeSwitch(j, ctx, {
    list: (j) => array(j, ctx, filterConfig),
    object: (j) => filterConfig(j, ctx).map((v) => [v]),
  })
}

export type FilterPair = {
  positive: FilterConfig[]
  negative: FilterConfig[]
}

const filterFields: StructFields<FilterPair> = {
  positive: field('filters', withDefault(orFilters, [])),
  negative: field('not_filters', withDefault(orFilters, [])),
}

export function filterPair(j: Json, ctx: Context): Maybe<FilterPair> {
  return struct(j, ctx, filterFields)
}

export type CommonDebug = {
  debugKey: bigint | null
  debugReporting: boolean
}

const commonDebugFields: StructFields<CommonDebug> = {
  debugKey: field('debug_key', withDefault(uint64, null)),
  debugReporting: field('debug_reporting', withDefault(bool, false)),
}

export type DedupKey = {
  dedupKey: bigint | null
}

const dedupKeyField: StructFields<DedupKey> = {
  dedupKey: field('deduplication_key', withDefault(uint64, null)),
}

export type Priority = {
  priority: bigint
}

const priorityField: StructFields<Priority> = {
  priority: field('priority', withDefault(int64, 0n)),
}

function aggregatableDebugType(
  j: Json,
  ctx: RegistrationContext
): Maybe<string> {
  return string(j, ctx).peek((s) => {
    if (!ctx.isDebugTypeSupported(s)) {
      ctx.warning('unknown type')
    }
  })
}

export type KeyPiece = {
  keyPiece: bigint
}

const keyPieceField: StructFields<KeyPiece> = {
  keyPiece: field('key_piece', required(hex128)),
}

export type AggregatableDebugReportingData = KeyPiece & {
  types: Set<string>
  value: number
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

export type AggregationCoordinatorOrigin = {
  aggregationCoordinatorOrigin: string
}

const aggregationCoordinatorOriginField: StructFields<
  AggregationCoordinatorOrigin,
  RegistrationContext
> = {
  aggregationCoordinatorOrigin: field(
    'aggregation_coordinator_origin',
    aggregationCoordinatorOrigin
  ),
}

export type AggregatableDebugReportingConfig = KeyPiece &
  AggregationCoordinatorOrigin & {
    debugData: AggregatableDebugReportingData[]
  }

const aggregatableDebugReportingConfig: StructFields<
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

function aggregationKeyIdentifierLength(
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

function aggregationKey([key, j]: [string, Json], ctx: Context): Maybe<bigint> {
  if (!aggregationKeyIdentifierLength(key, ctx, 'key ')) {
    return None
  }
  return hex128(j, ctx)
}

function aggregationKeys(j: Json, ctx: Context): Maybe<AggregationKeys> {
  return keyValues(
    j,
    ctx,
    aggregationKey,
    constants.maxAggregationKeysPerSource
  )
}

function roundAwayFromZeroToNearestDay(n: number): number {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError()
  }

  const r = n + constants.SECONDS_PER_DAY / 2
  return r - (r % constants.SECONDS_PER_DAY)
}

function expiry(j: Json, ctx: SourceContext): Maybe<number> {
  return legacyDuration(j, ctx)
    .map(clamp, ctx, ...constants.validSourceExpiryRange)
    .map(Number) // guaranteed to fit based on the clamping
    .map((n) => {
      switch (ctx.sourceType) {
        case SourceType.event: {
          const r = roundAwayFromZeroToNearestDay(n)
          if (n !== r) {
            ctx.warning(
              `will be rounded to nearest day (${r}) as source type is event`
            )
          }
          return r
        }
        case SourceType.navigation:
          return n
      }
    })
}

function singleReportWindow(
  j: Json,
  ctx: Context,
  expiry: Maybe<number>
): Maybe<number> {
  return legacyDuration(j, ctx)
    .map((n) => {
      if (expiry.value === undefined) {
        ctx.error('cannot be fully validated without a valid expiry')
        return None
      }
      return clamp(n, ctx, constants.minReportWindow, expiry.value, ' (expiry)')
    })
    .map(Number)
}

function defaultEventReportWindows(
  end: number,
  ctx: SourceContext
): EventReportWindows {
  const endTimes = constants.defaultEarlyEventLevelReportWindows[
    ctx.sourceType
  ].filter((e) => e < end)
  endTimes.push(end)
  return { startTime: 0, endTimes }
}

function eventReportWindow(
  j: Json,
  ctx: SourceContext,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return singleReportWindow(j, ctx, expiry).map(defaultEventReportWindows, ctx)
}

function eventLevelEpsilon(j: Json, ctx: SourceContext): Maybe<number> {
  return number(j, ctx).filter(
    isInRange,
    ctx,
    0,
    ctx.vsv.maxSettableEventLevelEpsilon
  )
}

function channelCapacity(s: Source, ctx: SourceContext): void {
  const numStatesWords = 'number of possible output states'

  const perTriggerDataConfigs = s.triggerSpecs.flatMap((spec) =>
    Array<privacy.PerTriggerDataConfig>(spec.triggerData.size).fill(
      new privacy.PerTriggerDataConfig(
        spec.eventReportWindows.endTimes.length,
        spec.summaryBuckets.length
      )
    )
  )

  const config = new privacy.Config(
    s.maxEventLevelReports,
    perTriggerDataConfigs
  )

  const out = config.computeConfigData(
    s.eventLevelEpsilon,
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  )

  const maxTriggerStates = ctx.vsv.maxTriggerStateCardinality

  if (out.numStates > maxTriggerStates) {
    ctx.error(
      `${numStatesWords} (${out.numStates}) exceeds max cardinality (${maxTriggerStates})`
    )
  }

  if (ctx.sourceType === SourceType.event && out.numStates > s.maxEventStates) {
    ctx.error(
      `${numStatesWords} (${out.numStates}) exceeds max event states (${s.maxEventStates})`
    )
  }

  const maxInfoGain =
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  const infoGainMsg = `information gain${
    s.attributionScopeLimit !== null ? ' for attribution scope' : ''
  }: ${out.infoGain.toFixed(2)}`

  if (out.infoGain > maxInfoGain) {
    ctx.error(
      `${infoGainMsg} exceeds max event-level channel capacity per ${
        ctx.sourceType
      } source (${maxInfoGain.toFixed(2)})`
    )
  } else if (ctx.noteInfoGain) {
    ctx.note(infoGainMsg)
  }

  if (ctx.noteInfoGain) {
    ctx.note(`${numStatesWords}: ${out.numStates}`)
    ctx.note(`randomized trigger rate: ${out.flipProb.toFixed(7)}`)
  }
}

export enum SummaryOperator {
  count = 'count',
  value_sum = 'value_sum',
}

export type TriggerSpec = {
  eventReportWindows: EventReportWindows
  summaryBuckets: number[]
  summaryOperator: SummaryOperator
  triggerData: Set<number>
}

export type SourceAggregatableDebugReportingConfig =
  AggregatableDebugReportingConfig & {
    budget: number
  }

function sourceAggregatableDebugReportingConfig(
  j: Json,
  ctx: RegistrationContext
): Maybe<SourceAggregatableDebugReportingConfig> {
  return struct(j, ctx, {
    budget: field('budget', required(aggregatableKeyValueValue)),
    ...aggregatableDebugReportingConfig,
  }).filter((s) => {
    for (const d of s.debugData) {
      if (d.value > s.budget) {
        // TODO: Consider passing the parsed budget to validate the debug data and
        // give more precise path information.
        ctx.error(`data contains value greater than budget (${s.budget})`)
        return false
      }
    }
    return true
  })
}

function summaryBuckets(
  j: Json | undefined,
  ctx: Context,
  maxEventLevelReports: Maybe<number>
): Maybe<number[]> {
  let maxLength
  if (maxEventLevelReports.value === undefined) {
    ctx.error(
      'cannot be fully validated without a valid max_event_level_reports'
    )
    maxLength = constants.maxSettableEventLevelAttributionsPerSource
  } else {
    maxLength = maxEventLevelReports.value
  }

  if (j === undefined) {
    return maxEventLevelReports.map(makeDefaultSummaryBuckets)
  }

  let prev = 0
  let prevDesc = 'implicit minimum'

  const bucket = (j: Json): Maybe<number> =>
    number(j, ctx)
      .filter(isInteger, ctx)
      .filter(
        isInRange,
        ctx,
        prev + 1,
        UINT32_MAX,
        `must be > ${prevDesc} (${prev}) and <= uint32 max (${UINT32_MAX})`
      )
      .peek((n) => {
        prev = n
        prevDesc = 'previous value'
      })

  return array(j, ctx, bucket, {
    minLength: 1,
    maxLength,
    maxLengthErrSuffix: ' (max_event_level_reports)',
    itemErrorAction: ItemErrorAction.earlyExit, // suppress unhelpful cascaded errors
  })
}

function fullFlexTriggerDatum(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 0, UINT32_MAX)
}

function triggerDataSet(
  j: Json,
  ctx: Context,
  allowEmpty: boolean = false
): Maybe<Set<number>> {
  return set(j, ctx, fullFlexTriggerDatum, {
    minLength: allowEmpty ? 0 : 1,
    maxLength: constants.maxTriggerDataPerSource,
    requireDistinct: true,
  })
}

type TriggerSpecDeps = {
  expiry: Maybe<number>
  eventReportWindows: Maybe<EventReportWindows>
  maxEventLevelReports: Maybe<number>
}

function makeDefaultSummaryBuckets(maxEventLevelReports: number): number[] {
  return Array.from({ length: maxEventLevelReports }, (_, i) => i + 1)
}

function triggerSpec(
  j: Json,
  ctx: SourceContext,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec> {
  return struct(j, ctx, {
    eventReportWindows: field('event_report_windows', (j) =>
      j === undefined
        ? deps.eventReportWindows
        : eventReportWindows(j, ctx, deps.expiry)
    ),

    summaryBuckets: field(
      'summary_buckets',
      summaryBuckets,
      deps.maxEventLevelReports
    ),

    summaryOperator: field(
      'summary_operator',
      withDefault(enumerated, SummaryOperator.count),
      SummaryOperator
    ),

    triggerData: field('trigger_data', required(triggerDataSet)),
  })
}

function triggerSpecs(
  j: Json,
  ctx: SourceContext,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec[]> {
  return array(j, ctx, (j) => triggerSpec(j, ctx, deps), {
    maxLength: constants.maxTriggerDataPerSource,
  }).filter((specs) => {
    const triggerData = new Set<number>()
    const dups = new Set<number>()
    for (const spec of specs) {
      for (const triggerDatum of spec.triggerData) {
        if (triggerData.has(triggerDatum)) {
          dups.add(triggerDatum)
        } else {
          triggerData.add(triggerDatum)
        }
      }
    }

    let ok = true
    if (triggerData.size > constants.maxTriggerDataPerSource) {
      ctx.error(
        `exceeds maximum number of distinct trigger_data (${triggerData.size} > ${constants.maxTriggerDataPerSource})`
      )
      ok = false
    }

    if (dups.size > 0) {
      ctx.error(`duplicate trigger_data: ${Array.from(dups).join(', ')}`)
      ok = false
    }

    return ok
  })
}

function triggerSpecsFromTriggerData(
  j: Json,
  ctx: Context,
  deps: TriggerSpecDeps
): Maybe<TriggerSpec[]> {
  return triggerDataSet(j, ctx, /*allowEmpty=*/ true).map((triggerData) => {
    if (
      triggerData.size === 0 ||
      deps.eventReportWindows.value === undefined ||
      deps.maxEventLevelReports.value === undefined
    ) {
      return []
    }

    return [
      {
        eventReportWindows: deps.eventReportWindows.value,
        summaryBuckets: makeDefaultSummaryBuckets(
          deps.maxEventLevelReports.value
        ),
        summaryOperator: SummaryOperator.count,
        triggerData: triggerData,
      },
    ]
  })
}

function defaultTriggerSpecs(
  ctx: SourceContext,
  eventReportWindows: Maybe<EventReportWindows>,
  maxEventLevelReports: Maybe<number>
): Maybe<TriggerSpec[]> {
  return eventReportWindows.flatMap((eventReportWindows) =>
    maxEventLevelReports.map((maxEventLevelReports) => [
      {
        eventReportWindows,
        summaryBuckets: Array.from(
          { length: maxEventLevelReports },
          (_, i) => i + 1
        ),
        summaryOperator: SummaryOperator.count,
        triggerData: new Set(
          Array.from(
            {
              length: Number(
                constants.defaultTriggerDataCardinality[ctx.sourceType]
              ),
            },
            (_, i) => i
          )
        ),
      },
    ])
  )
}

export enum TriggerDataMatching {
  exact = 'exact',
  modulus = 'modulus',
}

function isTriggerDataMatchingValidForSpecs(s: Source, ctx: Context): boolean {
  return ctx.scope('trigger_data_matching', () => {
    if (s.triggerDataMatching !== TriggerDataMatching.modulus) {
      return true
    }

    const triggerData: number[] = s.triggerSpecs
      .flatMap((spec) => Array.from(spec.triggerData))
      .sort()

    if (triggerData.some((triggerDatum, i) => triggerDatum !== i)) {
      ctx.error(
        'trigger_data must form a contiguous sequence of integers starting at 0 for modulus'
      )
      return false
    }

    return true
  })
}

function warnInconsistentMaxEventLevelReportsAndTriggerSpecs(
  s: Source,
  ctx: Context
): void {
  const allowsReports = s.maxEventLevelReports > 0
  const hasSpecs = s.triggerSpecs.length > 0

  if (allowsReports && !hasSpecs) {
    ctx.warning(
      'max_event_level_reports > 0 but event-level attribution will always fail because trigger_specs is empty'
    )
  } else if (hasSpecs && !allowsReports) {
    ctx.warning(
      'trigger_specs non-empty but event-level attribution will always fail because max_event_level_reports = 0'
    )
  }
}

export type AggregationKeys = Map<string, bigint>

export type Source = CommonDebug &
  Priority & {
    aggregatableReportWindow: number
    aggregationKeys: AggregationKeys
    destination: Set<string>
    expiry: number
    filterData: FilterData
    maxEventLevelReports: number
    sourceEventId: bigint

    triggerSpecs: TriggerSpec[]
    triggerDataMatching: TriggerDataMatching

    eventLevelEpsilon: number
    aggregatableDebugReporting: SourceAggregatableDebugReportingConfig | null
    destinationLimitPriority: bigint
    attributionScopes: Set<string>
    attributionScopeLimit: number | null
    maxEventStates: number
  }

function source(j: Json, ctx: SourceContext): Maybe<Source> {
  return object(j, ctx)
    .flatMap((j) => {
      const expiryVal = field(
        'expiry',
        withDefault(expiry, constants.validSourceExpiryRange[1])
      )(j, ctx)

      const eventReportWindowsVal = exclusive(
        {
          event_report_window: (j) => eventReportWindow(j, ctx, expiryVal),
          event_report_windows: (j) => eventReportWindows(j, ctx, expiryVal),
        },
        expiryVal.map(defaultEventReportWindows, ctx)
      )(j, ctx)

      const maxEventLevelReportsVal = field(
        'max_event_level_reports',
        maxEventLevelReports
      )(j, ctx)

      const defaultTriggerSpecsVal = defaultTriggerSpecs(
        ctx,
        eventReportWindowsVal,
        maxEventLevelReportsVal
      )

      const triggerSpecsDeps = {
        expiry: expiryVal,
        eventReportWindows: eventReportWindowsVal,
        maxEventLevelReports: maxEventLevelReportsVal,
      }

      const triggerSpecsVal = exclusive(
        {
          trigger_data: (j) =>
            triggerSpecsFromTriggerData(j, ctx, triggerSpecsDeps),
          ...(ctx.parseFullFlex
            ? {
                trigger_specs: (j) => triggerSpecs(j, ctx, triggerSpecsDeps),
              }
            : {}),
        },
        defaultTriggerSpecsVal
      )(j, ctx)

      const attributionScopeLimitVal = ctx.parseScopes
        ? field('attribution_scope_limit', withDefault(positiveUint32, null))(
            j,
            ctx
          )
        : some(null)

      return struct(j, ctx, {
        aggregatableReportWindow: field('aggregatable_report_window', (j) =>
          j === undefined ? expiryVal : singleReportWindow(j, ctx, expiryVal)
        ),
        aggregationKeys: field(
          'aggregation_keys',
          withDefault(aggregationKeys, new Map())
        ),
        destination: field('destination', required(destination)),
        eventLevelEpsilon: field(
          'event_level_epsilon',
          withDefault(eventLevelEpsilon, ctx.vsv.maxSettableEventLevelEpsilon)
        ),
        expiry: () => expiryVal,
        filterData: field('filter_data', withDefault(filterData, new Map())),
        maxEventLevelReports: () => maxEventLevelReportsVal,
        sourceEventId: field('source_event_id', withDefault(uint64, 0n)),
        triggerSpecs: () => triggerSpecsVal,
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          withDefault(sourceAggregatableDebugReportingConfig, null)
        ),

        triggerDataMatching: field(
          'trigger_data_matching',
          withDefault(enumerated, TriggerDataMatching.modulus),
          TriggerDataMatching
        ),
        destinationLimitPriority: field(
          'destination_limit_priority',
          withDefault(int64, 0n)
        ),
        attributionScopeLimit: () => attributionScopeLimitVal,
        attributionScopes: ctx.parseScopes
          ? field(
              'attribution_scopes',
              withDefault(attributionScopesForSource, new Set<string>()),
              attributionScopeLimitVal
            )
          : () => some(new Set<string>()),
        maxEventStates: ctx.parseScopes
          ? field(
              'max_event_states',
              withDefault(maxEventStates, constants.defaultMaxEventStates),
              attributionScopeLimitVal
            )
          : () => some(constants.defaultMaxEventStates),

        ...commonDebugFields,
        ...priorityField,
      })
    })
    .filter(isTriggerDataMatchingValidForSpecs, ctx)
    .peek(channelCapacity, ctx)
    .peek(warnInconsistentMaxEventLevelReportsAndTriggerSpecs, ctx)
}

function sourceKeys(j: Json, ctx: Context): Maybe<Set<string>> {
  return set(j, ctx, (j) =>
    string(j, ctx).filter(aggregationKeyIdentifierLength, ctx)
  )
}

export type AggregatableTriggerDatum = FilterPair &
  KeyPiece & {
    sourceKeys: Set<string>
  }

function aggregatableTriggerData(
  j: Json,
  ctx: RegistrationContext
): Maybe<AggregatableTriggerDatum[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      sourceKeys: field('source_keys', withDefault(sourceKeys, new Set())),
      ...filterFields,
      ...keyPieceField,
    })
  )
}

export type AggregatableValuesValue = {
  value: number
  filteringId: bigint
}

export type AggregatableValues = Map<string, AggregatableValuesValue>

export type AggregatableValuesConfiguration = FilterPair & {
  values: AggregatableValues
}

function aggregatableKeyValueValue(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, constants.allowedAggregatableBudgetPerSource)
}

function aggregatableKeyValueFilteringId(
  j: Json,
  ctx: Context,
  maxBytes: Maybe<number>
): Maybe<bigint> {
  return uint(j, ctx).filter((n) => {
    if (maxBytes.value === undefined) {
      ctx.error(
        `cannot be fully validated without a valid aggregatable_filtering_id_max_bytes`
      )
      return false
    }
    return isInRange(
      n,
      ctx,
      0n,
      256n ** BigInt(maxBytes.value) - 1n,
      maxBytes.value == constants.defaultAggregatableFilteringIdMaxBytes
        ? 'must be in the range [0, 255]. It exceeds the default max size of 1 byte. To increase, specify the aggregatable_filtering_id_max_bytes property.'
        : undefined
    )
  })
}

function aggregatableKeyValue(
  [key, j]: [string, Json],
  ctx: Context,
  maxBytes: Maybe<number>
): Maybe<AggregatableValuesValue> {
  if (!aggregationKeyIdentifierLength(key, ctx, 'key ')) {
    return None
  }

  return typeSwitch(j, ctx, {
    number: (j) =>
      aggregatableKeyValueValue(j, ctx).map((j) => ({
        value: j,
        filteringId: constants.defaultFilteringIdValue,
      })),
    object: (j) =>
      struct(j, ctx, {
        value: field('value', required(aggregatableKeyValueValue)),
        filteringId: field(
          'filtering_id',
          withDefault(aggregatableKeyValueFilteringId, 0n),
          maxBytes
        ),
      }),
  })
}

function aggregatableKeyValues(
  j: Json,
  ctx: Context,
  maxBytes: Maybe<number>
): Maybe<AggregatableValues> {
  return keyValues(j, ctx, (j) => aggregatableKeyValue(j, ctx, maxBytes))
}

function aggregatableValuesConfigurations(
  j: Json,
  ctx: Context,
  maxBytes: Maybe<number>
): Maybe<AggregatableValuesConfiguration[]> {
  return typeSwitch(j, ctx, {
    object: (j) =>
      aggregatableKeyValues(j, ctx, maxBytes).map((values) => [
        { values, positive: [], negative: [] },
      ]),
    list: (j) =>
      array(j, ctx, (j) =>
        struct(j, ctx, {
          values: field('values', required(aggregatableKeyValues), maxBytes),
          ...filterFields,
        })
      ),
  })
}

function aggregatableFilteringIdMaxBytes(
  j: Json,
  ctx: Context,
  aggregatableSourceRegTime: Maybe<AggregatableSourceRegistrationTime>
): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(
      isInRange,
      ctx,
      1,
      constants.maxAggregatableFilteringIdMaxBytesValue
    )
    .filter((n) => {
      if (aggregatableSourceRegTime.value === undefined) {
        ctx.error(
          `cannot be fully validated without a valid aggregatable_source_registration_time`
        )
        return false
      }
      if (
        aggregatableSourceRegTime.value !==
          AggregatableSourceRegistrationTime.exclude &&
        n !== constants.defaultAggregatableFilteringIdMaxBytes
      ) {
        ctx.error(
          `with a non-default value (higher than ${constants.defaultAggregatableFilteringIdMaxBytes}) is prohibited for aggregatable_source_registration_time ${aggregatableSourceRegTime.value}`
        )
        return false
      }

      return true
    })
}

export type EventTriggerDatum = FilterPair &
  Priority &
  DedupKey & {
    triggerData: bigint
    value: number
  }

function eventTriggerValue(j: Json, ctx: RegistrationContext): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(
      isInRange,
      ctx,
      1,
      UINT32_MAX,
      `must be >= 1 and <= uint32 max (${UINT32_MAX})`
    )
}

function eventTriggerData(
  j: Json,
  ctx: RegistrationContext
): Maybe<EventTriggerDatum[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      triggerData: field('trigger_data', withDefault(uint64, 0n)),

      value: ctx.parseFullFlex
        ? field('value', withDefault(eventTriggerValue, 1))
        : () => some(1),

      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

function positiveUint32(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, UINT32_MAX)
}

function maxEventStates(
  j: Json,
  ctx: SourceContext,
  attributionScopeLimit: Maybe<number | null>
): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, ctx.vsv.maxTriggerStateCardinality)
    .filter((n) => {
      if (attributionScopeLimit.value === undefined) {
        ctx.error(
          'cannot be fully validated without a valid attribution_scope_limit'
        )
        return false
      }
      if (
        attributionScopeLimit.value === null &&
        n !== constants.defaultMaxEventStates
      ) {
        ctx.error(
          `must be default (${constants.defaultMaxEventStates}) if attribution_scope_limit is not set`
        )
        return false
      }
      return true
    })
}

function attributionScopesForSource(
  j: Json,
  ctx: SourceContext,
  attributionScopeLimit: Maybe<number | null>
): Maybe<Set<string>> {
  const attributionScopeStringLength = (s: string) => {
    if (s.length > constants.maxLengthPerAttributionScope) {
      ctx.error(
        `exceeds max length per attribution scope (${s.length} > ${constants.maxLengthPerAttributionScope})`
      )
      return false
    }
    return true
  }

  return set(j, ctx, (j) =>
    string(j, ctx).filter(attributionScopeStringLength)
  ).filter((scopes) => {
    if (attributionScopeLimit.value === undefined) {
      ctx.error(
        'cannot be fully validated without a valid attribution_scope_limit'
      )
      return false
    }
    if (attributionScopeLimit.value === null) {
      if (scopes.size > 0) {
        ctx.error('must be empty if attribution_scope_limit is not set')
        return false
      }
      return true
    }
    if (scopes.size === 0) {
      ctx.error('must be non-empty if attribution_scope_limit is set')
      return false
    }
    const maxLength = Math.min(
      attributionScopeLimit.value,
      constants.maxAttributionScopesPerSource
    )
    const errorMsg =
      'size must be less than or equal to ' +
      (attributionScopeLimit.value < constants.maxAttributionScopesPerSource
        ? 'attribution_scope_limit'
        : 'max number of attribution scopes') +
      ` (${maxLength}) if attribution_scope_limit is set`

    return isInRange(scopes.size, ctx, 1, maxLength, errorMsg)
  })
}

export type AggregatableDedupKey = FilterPair & DedupKey

function aggregatableDedupKeys(
  j: Json,
  ctx: RegistrationContext
): Maybe<AggregatableDedupKey[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      ...dedupKeyField,
      ...filterFields,
    })
  )
}

function enumerated<T>(j: Json, ctx: Context, e: Record<string, T>): Maybe<T> {
  return string(j, ctx).flatMap(validate.enumerated, ctx, e)
}

export enum AggregatableSourceRegistrationTime {
  exclude = 'exclude',
  include = 'include',
}

function warnInconsistentAggregatableKeys(t: Trigger, ctx: Context): void {
  const allAggregatableValueKeys = new Set<string>()
  for (const cfg of t.aggregatableValuesConfigurations) {
    for (const key of cfg.values.keys()) {
      allAggregatableValueKeys.add(key)
    }
  }

  const triggerDataKeys = new Set<string>()

  ctx.scope('aggregatable_trigger_data', () => {
    for (const [index, datum] of t.aggregatableTriggerData.entries()) {
      ctx.scope(index, () => {
        for (const key of datum.sourceKeys) {
          triggerDataKeys.add(key)

          if (!allAggregatableValueKeys.has(key)) {
            ctx.scope('source_keys', () =>
              ctx.warning(
                `key "${key}" will never result in a contribution due to absence from aggregatable_values`
              )
            )
          }
        }
      })
    }
  })

  ctx.scope('aggregatable_values', () => {
    for (const key of allAggregatableValueKeys) {
      if (!triggerDataKeys.has(key)) {
        ctx.warning(
          `key "${key}"'s absence from aggregatable_trigger_data source_keys equivalent to presence with key_piece 0x0`
        )
      }
    }
  })
}

function triggerContextID(
  j: Json,
  ctx: Context,
  aggregatableSourceRegTime: Maybe<AggregatableSourceRegistrationTime>
): Maybe<string> {
  return string(j, ctx).filter((s) => {
    if (s.length > constants.maxLengthPerTriggerContextID) {
      ctx.error(
        `exceeds max length per trigger context ID (${s.length} > ${constants.maxLengthPerTriggerContextID})`
      )
      return false
    }
    if (aggregatableSourceRegTime.value === undefined) {
      ctx.error(
        `cannot be fully validated without a valid aggregatable_source_registration_time`
      )
      return false
    }
    if (
      aggregatableSourceRegTime.value !==
      AggregatableSourceRegistrationTime.exclude
    ) {
      ctx.error(
        `is prohibited for aggregatable_source_registration_time ${aggregatableSourceRegTime.value}`
      )
      return false
    }
    return true
  })
}

function aggregationCoordinatorOrigin(
  j: Json | undefined,
  ctx: RegistrationContext
): Maybe<string> {
  return j === undefined
    ? some(ctx.vsv.aggregationCoordinatorOrigins[0])
    : string(j, ctx)
        .flatMap(suitableOrigin, ctx)
        .filter((s) => {
          if (!ctx.vsv.aggregationCoordinatorOrigins.includes(s)) {
            const allowed = ctx.vsv.aggregationCoordinatorOrigins.join(', ')
            ctx.error(`must be one of the following: ${allowed}`)
            return false
          }
          return true
        })
}

export type Trigger = CommonDebug &
  FilterPair &
  AggregationCoordinatorOrigin & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: AggregatableSourceRegistrationTime
    aggregatableFilteringIdMaxBytes: number
    aggregatableValuesConfigurations: AggregatableValuesConfiguration[]
    eventTriggerData: EventTriggerDatum[]
    triggerContextID: string | null
    aggregatableDebugReporting: AggregatableDebugReportingConfig | null
    attributionScopes: Set<string>
  }

function trigger(j: Json, ctx: RegistrationContext): Maybe<Trigger> {
  return object(j, ctx)
    .flatMap((j) => {
      const aggregatableSourceRegTimeVal = field(
        'aggregatable_source_registration_time',
        withDefault(enumerated, AggregatableSourceRegistrationTime.exclude),
        AggregatableSourceRegistrationTime
      )(j, ctx)

      const aggregatableFilteringIdMaxBytesVal = field(
        'aggregatable_filtering_id_max_bytes',
        withDefault(
          aggregatableFilteringIdMaxBytes,
          constants.defaultAggregatableFilteringIdMaxBytes
        ),
        aggregatableSourceRegTimeVal
      )(j, ctx)

      return struct(j, ctx, {
        aggregatableTriggerData: field(
          'aggregatable_trigger_data',
          withDefault(aggregatableTriggerData, [])
        ),
        aggregatableFilteringIdMaxBytes: () =>
          aggregatableFilteringIdMaxBytesVal,
        aggregatableValuesConfigurations: field(
          'aggregatable_values',
          withDefault(aggregatableValuesConfigurations, []),
          aggregatableFilteringIdMaxBytesVal
        ),
        aggregatableDedupKeys: field(
          'aggregatable_deduplication_keys',
          withDefault(aggregatableDedupKeys, [])
        ),
        aggregatableSourceRegistrationTime: () => aggregatableSourceRegTimeVal,
        eventTriggerData: field(
          'event_trigger_data',
          withDefault(eventTriggerData, [])
        ),
        triggerContextID: field(
          'trigger_context_id',
          withDefault(triggerContextID, null),
          aggregatableSourceRegTimeVal
        ),
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          withDefault(struct, null),
          aggregatableDebugReportingConfig
        ),
        attributionScopes: ctx.parseScopes
          ? field(
              'attribution_scopes',
              withDefault(set, new Set<string>()),
              string
            )
          : () => some(new Set<string>()),
        ...aggregationCoordinatorOriginField,
        ...commonDebugFields,
        ...filterFields,
      })
    })
    .peek(warnInconsistentAggregatableKeys, ctx)
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

export function validateSource(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  sourceType: SourceType,
  parseFullFlex: boolean = false,
  noteInfoGain: boolean = false,
  parseScopes: boolean = false
): [ValidationResult, Maybe<Source>] {
  return validateJSON(
    new SourceContext(
      vsv,
      parseFullFlex,
      sourceType,
      noteInfoGain,
      parseScopes
    ),
    json,
    source
  )
}

export function validateTrigger(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  parseFullFlex: boolean = false,
  parseScopes: boolean = false
): [ValidationResult, Maybe<Trigger>] {
  return validateJSON(
    new RegistrationContext(
      vsv,
      parseFullFlex,
      constants.triggerAggregatableDebugTypes,
      parseScopes
    ),
    json,
    trigger
  )
}

export type EventLevelReport = {
  attributionDestination: string | string[]
  randomizedTriggerRate: number
  reportId: string
  scheduledReportTime: bigint
  sourceDebugKey: bigint | null
  sourceType: SourceType
  sourceEventId: bigint
  triggerData: bigint
  triggerDebugKey: bigint | null
  triggerSummaryBucket: [number, number] | null
}

function reportDestination(j: Json, ctx: Context): Maybe<string | string[]> {
  const suitableSiteNoExtraneous = (s: string) =>
    suitableSite(s, ctx, /*rejectExtraComponents=*/ true)

  return typeSwitch<string | string[]>(j, ctx, {
    string: suitableSiteNoExtraneous,
    list: (j) =>
      array(j, ctx, (j) => string(j, ctx).flatMap(suitableSiteNoExtraneous), {
        minLength: 2,
        maxLength: 3,
      }).filter((v) => {
        for (let i = 1; i < v.length; ++i) {
          if (v[i]! <= v[i - 1]!) {
            ctx.error(
              'although order is semantically irrelevant, list must be sorted and contain no duplicates'
            )
            return false
          }
        }
        return true
      }),
  })
}

function randomizedTriggerRate(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx).filter(isInRange, ctx, 0, 1)
}

function randomUuid(j: Json, ctx: Context): Maybe<string> {
  return string(j, ctx).filter((s) => {
    if (!uuid.validate(s)) {
      ctx.error('must be a valid UUID')
      return false
    }
    if (uuid.version(s) !== 4) {
      ctx.error('must be a version 4 (random) UUID')
      return false
    }
    return true
  })
}

function triggerSummaryBucket(j: Json, ctx: Context): Maybe<[number, number]> {
  let prev = 1
  let prevDesc = 'minimum bucket start'

  const endpoint = (j: Json): Maybe<number> =>
    number(j, ctx)
      .filter(isInteger, ctx)
      .filter(
        isInRange,
        ctx,
        prev,
        UINT32_MAX,
        `must be >= ${prevDesc} (${prev}) and <= uint32 max (${UINT32_MAX})`
      )
      .peek((n) => {
        prev = n
        prevDesc = 'bucket start'
      })

  return array(j, ctx, endpoint, {
    minLength: 2,
    maxLength: 2,
    itemErrorAction: ItemErrorAction.earlyExit,
  }) as Maybe<[number, number]>
}

function eventLevelReport(
  j: Json,
  ctx: GenericContext
): Maybe<EventLevelReport> {
  return struct(j, ctx, {
    attributionDestination: field(
      'attribution_destination',
      required(reportDestination)
    ),
    randomizedTriggerRate: field(
      'randomized_trigger_rate',
      required(randomizedTriggerRate)
    ),
    reportId: field('report_id', required(randomUuid)),
    scheduledReportTime: field('scheduled_report_time', required(int64)),
    sourceDebugKey: field('source_debug_key', withDefault(uint64, null)),
    sourceEventId: field('source_event_id', required(uint64)),
    sourceType: field('source_type', required(enumerated), SourceType),
    triggerData: field('trigger_data', required(uint64)),
    // TODO: Flex can issue multiple trigger debug keys.
    triggerDebugKey: field('trigger_debug_key', withDefault(uint64, null)),

    triggerSummaryBucket: ctx.parseFullFlex
      ? field('trigger_summary_bucket', required(triggerSummaryBucket))
      : () => some(null),
  })
}

export function validateEventLevelReport(
  json: string,
  parseFullFlex: boolean = false
): [ValidationResult, Maybe<EventLevelReport>] {
  return validateJSON(new GenericContext(parseFullFlex), json, eventLevelReport)
}
