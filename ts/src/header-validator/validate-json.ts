import * as psl from 'psl'
import * as uuid from 'uuid'
import * as constants from '../constants'
import { SourceType } from '../source-type'
import { VendorSpecificValues } from '../vendor-specific-values'
import { Context, ValidationResult } from './context'
import { Maybe } from './maybe'
import {
  CtxFunc,
  ItemErrorAction,
  clamp,
  isInteger,
  isInRange,
  matchesPattern,
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
    readonly aggregatableDebugTypes: Readonly<[string, ...string[]]>
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
    readonly noteInfoGain: boolean
  ) {
    super(vsv, parseFullFlex, constants.sourceAggregatableDebugTypes)
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
  return object(d, ctx).map(structInternal, ctx, fields, warnUnknown)
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
  return object(j, ctx).map((d) => {
    const entries = Object.entries(d)

    if (entries.length > maxKeys) {
      ctx.error(`exceeds the maximum number of keys (${maxKeys})`)
      return None
    }

    return validate.keyValues(entries, ctx, f)
  })
}

type LengthOpts = {
  minLength?: number
  maxLength?: number
  maxLengthErrSuffix?: string
}

function list(j: Json, ctx: Context): Maybe<Json[]> {
  return typeSwitch(j, ctx, { list: some })
}

function isLengthValid(
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

function uint64(j: Json, ctx: Context): Maybe<bigint> {
  return string(j, ctx)
    .filter(
      matchesPattern,
      ctx,
      uintRegex,
      'string must represent a non-negative integer'
    )
    .map(BigInt)
    .filter(
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
    return None
  }

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  ) {
    ctx.error('URL must use HTTP/HTTPS and be potentially trustworthy')
    return None
  }

  const scoped = scope(url)
  if (url.toString() !== new URL(scoped).toString()) {
    if (rejectExtraComponents) {
      ctx.error(
        `must not contain URL components other than ${label} (${scoped})`
      )
      return None
    }
    ctx.warning(
      `URL components other than ${label} (${scoped}) will be ignored`
    )
  }
  return some(scoped)
}

function suitableOrigin(
  j: Json,
  ctx: Context,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return string(j, ctx).map(
    suitableScope,
    ctx,
    'origin',
    (u) => u.origin,
    rejectExtraComponents
  )
}

function suitableSite(
  j: Json,
  ctx: Context,
  rejectExtraComponents: boolean = false
): Maybe<string> {
  return string(j, ctx).map(
    suitableScope,
    ctx,
    'site',
    (u) => `${u.protocol}//${psl.get(u.hostname)}`,
    rejectExtraComponents
  )
}

function destination(j: Json, ctx: Context): Maybe<Set<string>> {
  return typeSwitch(j, ctx, {
    string: (j) => suitableSite(j, ctx).map((s) => new Set([s])),
    list: (j) => set(j, ctx, suitableSite, { minLength: 1, maxLength: 3 }),
  })
}

function maxEventLevelReports(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
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
  return object(j, ctx).map((j) => {
    const startTimeValue = field(
      'start_time',
      (j) => startTime(j, ctx, expiry),
      0
    )(j, ctx)

    return struct(j, ctx, {
      startTime: () => startTimeValue,
      endTimes: field('end_times', (j) =>
        endTimes(j, ctx, expiry, startTimeValue)
      ),
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
    .map((js) => validate.set(js.entries(), ctx, f, opts?.requireDistinct))
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
    .map((js) => validate.array(js.entries(), ctx, f, opts?.itemErrorAction))
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
      lookbackWindow: field('_lookback_window', positiveInteger, null),
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
  positive: field('filters', orFilters, []),
  negative: field('not_filters', orFilters, []),
}

export function filterPair(j: Json, ctx: Context): Maybe<FilterPair> {
  return struct(j, ctx, filterFields)
}

export type CommonDebug = {
  debugKey: bigint | null
  debugReporting: boolean
}

const commonDebugFields: StructFields<CommonDebug> = {
  debugKey: field('debug_key', uint64, null),
  debugReporting: field('debug_reporting', bool, false),
}

export type DedupKey = {
  dedupKey: bigint | null
}

const dedupKeyField: StructFields<DedupKey> = {
  dedupKey: field('deduplication_key', uint64, null),
}

export type Priority = {
  priority: bigint
}

const priorityField: StructFields<Priority> = {
  priority: field('priority', int64, 0n),
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
  keyPiece: field('key_piece', hex128),
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
    types: field('types', (j) =>
      set(j, ctx, aggregatableDebugType, {
        minLength: 1,
        requireDistinct: true,
      })
    ),
    value: field('value', aggregatableValue),

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

// Consider making this a StructFields.
function aggregationCoordinatorOriginField(
  j: JsonDict,
  ctx: RegistrationContext
): Maybe<string> {
  return field(
    'aggregation_coordinator_origin',
    aggregationCoordinatorOrigin,
    ctx.vsv.aggregationCoordinatorOrigins[0]
  )(j, ctx)
}

export type AggregatableDebugReportingConfig = KeyPiece & {
  aggregationCoordinatorOrigin: string
  debugData: AggregatableDebugReportingData[]
}

const aggregatableDebugReportingConfig: StructFields<
  AggregatableDebugReportingConfig,
  RegistrationContext
> = {
  aggregationCoordinatorOrigin: aggregationCoordinatorOriginField,
  debugData: field('debug_data', aggregatableDebugReportingDataList, []),

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
        case SourceType.event:
          const r = roundAwayFromZeroToNearestDay(n)
          if (n !== r) {
            ctx.warning(
              `will be rounded to nearest day (${r}) as source type is event`
            )
          }
          return r
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

function eventLevelEpsilon(j: Json, ctx: RegistrationContext): Maybe<number> {
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
    Array(spec.triggerData.size).fill(
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

  const maxInfoGain =
    ctx.vsv.maxEventLevelChannelCapacityPerSource[ctx.sourceType]
  const infoGainMsg = `information gain: ${out.infoGain.toFixed(2)}`

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

export enum SummaryWindowOperator {
  count = 'count',
  value_sum = 'value_sum',
}

export type TriggerSpec = {
  eventReportWindows: EventReportWindows
  summaryBuckets: number[]
  summaryWindowOperator: SummaryWindowOperator
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
    budget: field('budget', aggregatableValue),

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
  j: Json,
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
  const defaultSummaryBuckets = deps.maxEventLevelReports.map(
    makeDefaultSummaryBuckets
  )

  return struct(j, ctx, {
    eventReportWindows: field(
      'event_report_windows',
      (j) => eventReportWindows(j, ctx, deps.expiry),
      deps.eventReportWindows
    ),

    summaryBuckets: field(
      'summary_buckets',
      (j) => summaryBuckets(j, ctx, deps.maxEventLevelReports),
      defaultSummaryBuckets
    ),

    summaryWindowOperator: field(
      'summary_window_operator',
      (j) => enumerated(j, ctx, SummaryWindowOperator),
      SummaryWindowOperator.count
    ),

    triggerData: field('trigger_data', triggerDataSet),
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
        summaryWindowOperator: SummaryWindowOperator.count,
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
  return eventReportWindows.map((eventReportWindows) =>
    maxEventLevelReports.map((maxEventLevelReports) => [
      {
        eventReportWindows,
        summaryBuckets: Array.from(
          { length: maxEventLevelReports },
          (_, i) => i + 1
        ),
        summaryWindowOperator: SummaryWindowOperator.count,
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

function triggerDataMatching(
  j: Json,
  ctx: Context
): Maybe<TriggerDataMatching> {
  return enumerated(j, ctx, TriggerDataMatching)
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
  }

function source(j: Json, ctx: SourceContext): Maybe<Source> {
  return object(j, ctx)
    .map((j) => {
      const expiryVal = field(
        'expiry',
        expiry,
        constants.validSourceExpiryRange[1]
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
        maxEventLevelReports,
        constants.defaultEventLevelAttributionsPerSource[ctx.sourceType]
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

      return struct(j, ctx, {
        aggregatableReportWindow: field(
          'aggregatable_report_window',
          (j) => singleReportWindow(j, ctx, expiryVal),
          expiryVal
        ),
        aggregationKeys: field('aggregation_keys', aggregationKeys, new Map()),
        destination: field('destination', destination),
        eventLevelEpsilon: field(
          'event_level_epsilon',
          eventLevelEpsilon,
          ctx.vsv.maxSettableEventLevelEpsilon
        ),
        expiry: () => expiryVal,
        filterData: field('filter_data', filterData, new Map()),
        maxEventLevelReports: () => maxEventLevelReportsVal,
        sourceEventId: field('source_event_id', uint64, 0n),
        triggerSpecs: () => triggerSpecsVal,
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          sourceAggregatableDebugReportingConfig,
          null
        ),

        triggerDataMatching: field(
          'trigger_data_matching',
          triggerDataMatching,
          TriggerDataMatching.modulus
        ),

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
      sourceKeys: field('source_keys', sourceKeys, new Set<string>()),
      ...filterFields,
      ...keyPieceField,
    })
  )
}

export type AggregatableValues = Map<string, number>

export type AggregatableValuesConfiguration = FilterPair & {
  values: AggregatableValues
}

function aggregatableValue(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, constants.allowedAggregatableBudgetPerSource)
}

function aggregatableKeyValue(
  [key, j]: [string, Json],
  ctx: Context
): Maybe<number> {
  if (!aggregationKeyIdentifierLength(key, ctx, 'key ')) {
    return None
  }
  return aggregatableValue(j, ctx)
}

function aggregatableKeyValues(
  j: Json,
  ctx: Context
): Maybe<AggregatableValues> {
  return keyValues(j, ctx, aggregatableKeyValue)
}

function aggregatableValuesConfigurations(
  j: Json,
  ctx: Context
): Maybe<AggregatableValuesConfiguration[]> {
  return typeSwitch(j, ctx, {
    object: (j) =>
      aggregatableKeyValues(j, ctx).map((values) => [
        { values, positive: [], negative: [] },
      ]),
    list: (j) =>
      array(j, ctx, (j) =>
        struct(j, ctx, {
          values: field('values', aggregatableKeyValues),
          ...filterFields,
        })
      ),
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
      triggerData: field('trigger_data', uint64, 0n),

      value: ctx.parseFullFlex
        ? field('value', eventTriggerValue, 1)
        : () => some(1),

      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
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
  return string(j, ctx).map(validate.enumerated, ctx, e)
}

export enum AggregatableSourceRegistrationTime {
  exclude = 'exclude',
  include = 'include',
}

function aggregatableSourceRegistrationTime(
  j: Json,
  ctx: Context
): Maybe<AggregatableSourceRegistrationTime> {
  return enumerated(j, ctx, AggregatableSourceRegistrationTime)
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
  j: Json,
  ctx: RegistrationContext
): Maybe<string> {
  return suitableOrigin(j, ctx).filter((s) => {
    if (!ctx.vsv.aggregationCoordinatorOrigins.includes(s)) {
      const allowed = ctx.vsv.aggregationCoordinatorOrigins.join(', ')
      ctx.error(`must be one of the following: ${allowed}`)
      return false
    }
    return true
  })
}

export type Trigger = CommonDebug &
  FilterPair & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: AggregatableSourceRegistrationTime
    aggregatableValuesConfigurations: AggregatableValuesConfiguration[]
    aggregationCoordinatorOrigin: string
    eventTriggerData: EventTriggerDatum[]
    triggerContextID: string | null
    aggregatableDebugReporting: AggregatableDebugReportingConfig | null
  }

function trigger(j: Json, ctx: RegistrationContext): Maybe<Trigger> {
  return object(j, ctx)
    .map((j) => {
      const aggregatableSourceRegTimeVal = field(
        'aggregatable_source_registration_time',
        aggregatableSourceRegistrationTime,
        AggregatableSourceRegistrationTime.exclude
      )(j, ctx)

      return struct(j, ctx, {
        aggregatableTriggerData: field(
          'aggregatable_trigger_data',
          aggregatableTriggerData,
          []
        ),
        aggregatableValuesConfigurations: field(
          'aggregatable_values',
          aggregatableValuesConfigurations,
          []
        ),
        aggregatableDedupKeys: field(
          'aggregatable_deduplication_keys',
          aggregatableDedupKeys,
          []
        ),
        aggregatableSourceRegistrationTime: () => aggregatableSourceRegTimeVal,
        aggregationCoordinatorOrigin: aggregationCoordinatorOriginField,
        eventTriggerData: field('event_trigger_data', eventTriggerData, []),
        triggerContextID: field(
          'trigger_context_id',
          (j) => triggerContextID(j, ctx, aggregatableSourceRegTimeVal),
          null
        ),
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          (j) => struct(j, ctx, aggregatableDebugReportingConfig),
          null
        ),
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
  let value
  try {
    value = JSON.parse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.toString() : 'unknown error'
    return [ctx.finish(msg), None]
  }

  const v = f(value, ctx)
  return [ctx.finish(), v]
}

export function validateSource(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  sourceType: SourceType,
  parseFullFlex: boolean = false,
  noteInfoGain: boolean = false
): [ValidationResult, Maybe<Source>] {
  return validateJSON(
    new SourceContext(vsv, parseFullFlex, sourceType, noteInfoGain),
    json,
    source
  )
}

export function validateTrigger(
  json: string,
  vsv: Readonly<VendorSpecificValues>,
  parseFullFlex: boolean = false
): [ValidationResult, Maybe<Trigger>] {
  return validateJSON(
    new RegistrationContext(
      vsv,
      parseFullFlex,
      constants.triggerAggregatableDebugTypes
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
  const suitableSiteNoExtraneous = (j: Json) =>
    suitableSite(j, ctx, /*rejectExtraComponents=*/ true)

  return typeSwitch<string | string[]>(j, ctx, {
    string: suitableSiteNoExtraneous,
    list: (j) =>
      array(j, ctx, suitableSiteNoExtraneous, {
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
    attributionDestination: field('attribution_destination', reportDestination),
    randomizedTriggerRate: field(
      'randomized_trigger_rate',
      randomizedTriggerRate
    ),
    reportId: field('report_id', randomUuid),
    scheduledReportTime: field('scheduled_report_time', int64),
    sourceDebugKey: field('source_debug_key', uint64, null),
    sourceEventId: field('source_event_id', uint64),
    sourceType: field('source_type', (ctx, j) =>
      enumerated(ctx, j, SourceType)
    ),
    triggerData: field('trigger_data', uint64),
    // TODO: Flex can issue multiple trigger debug keys.
    triggerDebugKey: field('trigger_debug_key', uint64, null),

    triggerSummaryBucket: ctx.parseFullFlex
      ? field('trigger_summary_bucket', triggerSummaryBucket)
      : () => some(null),
  })
}

export function validateEventLevelReport(
  json: string,
  parseFullFlex: boolean = false
): [ValidationResult, Maybe<EventLevelReport>] {
  return validateJSON(new GenericContext(parseFullFlex), json, eventLevelReport)
}
