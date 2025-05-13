import * as constants from '../constants'
import { SourceType } from '../source-type'
import * as context from './context'
import { Maybe } from './maybe'
import {
  NamedBudgets,
  AggregationKeys,
  AttributionScopes,
  EventReportWindows,
  FilterData,
  Source,
  SourceAggregatableDebugReportingConfig,
  TriggerDataMatching,
} from './source'
import {
  ItemErrorAction,
  clamp,
  isInteger,
  isInRange,
  required,
  suitableSite,
  withDefault,
  withErrorAsWarning,
} from './validate'
import * as privacy from '../flexible-event/privacy'
import { serializeSource } from './to-json'
import {
  Json,
  RegistrationContext,
  RegistrationOptions,
  UINT32_MAX,
  aggregatableDebugReportingConfig,
  aggregatableKeyValueValue,
  aggregationKeyIdentifierLength,
  array,
  commonDebugFields,
  enumerated,
  exclusive,
  field,
  hex128,
  int64,
  keyValues,
  nonNegativeInteger,
  number,
  object,
  positiveInteger,
  positiveUint32,
  priorityField,
  set,
  string,
  struct,
  typeSwitch,
  uint64,
  validateJSON,
} from './validate-json'
import { Validator } from './validator'

export interface SourceOptions extends RegistrationOptions {
  sourceType: SourceType
  noteInfoGain?: boolean | undefined
}

type Context = RegistrationContext<SourceOptions>

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
  ctx: Context
): Maybe<number> {
  return j === undefined
    ? Maybe.some(
        constants.defaultEventLevelAttributionsPerSource[ctx.opts.sourceType]
      )
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
    return Maybe.None
  }

  if (expiry.value === undefined) {
    ctx.error('cannot be fully validated without a valid expiry')
    return Maybe.None
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

function eventReportWindows(
  j: Json,
  ctx: Context,
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

function filterDataKeyValue(
  [key, j]: [string, Json],
  ctx: context.Context
): Maybe<Set<string>> {
  if (key === 'source_type' || key === '_lookback_window') {
    ctx.error('is prohibited because it is implicitly set')
    return Maybe.None
  }
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return Maybe.None
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
    return Maybe.None
  }

  return set(j, ctx, (j) => string(j, ctx).filter(filterStringLength), {
    maxLength: constants.maxValuesPerFilterDataEntry,
  })
}

export function filterData(j: Json, ctx: context.Context): Maybe<FilterData> {
  return keyValues(
    j,
    ctx,
    filterDataKeyValue,
    constants.maxEntriesPerFilterData
  )
}

function aggregationKey([key, j]: [string, Json], ctx: Context): Maybe<bigint> {
  if (!aggregationKeyIdentifierLength(key, ctx, 'key ')) {
    return Maybe.None
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

function namedBudgetValue(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 0, constants.allowedAggregatableBudgetPerSource)
}

function namedBudget([name, j]: [string, Json], ctx: Context): Maybe<number> {
  if (name.length > constants.maxLengthPerBudgetName) {
    ctx.error(
      `name exceeds max length per budget name (${name.length} > ${constants.maxLengthPerBudgetName})`
    )
    return Maybe.None
  }
  return namedBudgetValue(j, ctx)
}

function namedBudgets(j: Json, ctx: Context): Maybe<NamedBudgets> {
  return keyValues(j, ctx, namedBudget, constants.maxNamedBudgetsPerSource)
}

function roundAwayFromZeroToNearestDay(n: number): number {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError()
  }

  const r = n + constants.SECONDS_PER_DAY / 2
  return r - (r % constants.SECONDS_PER_DAY)
}

function expiry(j: Json, ctx: Context): Maybe<number> {
  return legacyDuration(j, ctx)
    .map(clamp, ctx, ...constants.validSourceExpiryRange)
    .map(Number) // guaranteed to fit based on the clamping
    .map((n) => {
      switch (ctx.opts.sourceType) {
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
        return Maybe.None
      }
      return clamp(n, ctx, constants.minReportWindow, expiry.value, ' (expiry)')
    })
    .map(Number)
}

function defaultEventReportWindows(
  end: number,
  ctx: Context
): EventReportWindows {
  const endTimes = constants.defaultEarlyEventLevelReportWindows[
    ctx.opts.sourceType
  ].filter((e) => e < end)
  endTimes.push(end)
  return { startTime: 0, endTimes }
}

function eventReportWindow(
  j: Json,
  ctx: Context,
  expiry: Maybe<number>
): Maybe<EventReportWindows> {
  return singleReportWindow(j, ctx, expiry).map(defaultEventReportWindows, ctx)
}

function eventLevelEpsilon(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx).filter(
    isInRange,
    ctx,
    0,
    ctx.opts.vsv.maxSettableEventLevelEpsilon
  )
}

function channelCapacity(s: Source, ctx: Context): void {
  const numStatesWords = 'number of possible output states'

  const perTriggerDataConfigs = Array<privacy.PerTriggerDataConfig>(
    s.triggerData.size
  ).fill(
    new privacy.PerTriggerDataConfig(
      s.eventReportWindows.endTimes.length,
      s.maxEventLevelReports
    )
  )

  const config = new privacy.Config(
    s.maxEventLevelReports,
    s.attributionScopes,
    perTriggerDataConfigs
  )

  const out = config.computeConfigData(
    s.eventLevelEpsilon,
    ctx.opts.vsv.maxEventLevelChannelCapacityPerSource[ctx.opts.sourceType]
  )

  const maxTriggerStates = ctx.opts.vsv.maxTriggerStateCardinality

  if (out.numStates > maxTriggerStates) {
    ctx.error(
      `${numStatesWords} (${out.numStates}) exceeds max cardinality (${maxTriggerStates})`
    )
  }

  if (
    s.attributionScopes !== null &&
    ctx.opts.sourceType === SourceType.event &&
    out.numStates > s.attributionScopes.maxEventStates
  ) {
    ctx.error(
      `${numStatesWords} (${out.numStates}) exceeds max event states (${s.attributionScopes.maxEventStates})`
    )
  }

  const maxInfoGain =
    ctx.opts.vsv.maxEventLevelChannelCapacityPerSource[ctx.opts.sourceType]
  const infoGainMsg = `information gain: ${out.infoGain.toFixed(2)}`

  if (out.infoGain > maxInfoGain) {
    ctx.error(
      `${infoGainMsg} exceeds max event-level channel capacity per ${
        ctx.opts.sourceType
      } source (${maxInfoGain.toFixed(2)})`
    )
  } else if (ctx.opts.noteInfoGain) {
    ctx.note(infoGainMsg)
  }

  if (out.attributionScopesInfoGain !== undefined) {
    const attributionScopesInfoGainMsg = `information gain for attribution scope: ${out.attributionScopesInfoGain.toFixed(2)}`
    const maxAttributionScopeInfoGain =
      ctx.opts.vsv.maxEventLevelAttributionScopesChannelCapacityPerSource[
        ctx.opts.sourceType
      ]

    if (out.attributionScopesInfoGain > maxAttributionScopeInfoGain) {
      ctx.error(
        `${attributionScopesInfoGainMsg} exceeds max event-level attribution scope information gain per ${
          ctx.opts.sourceType
        } source (${maxAttributionScopeInfoGain.toFixed(2)})`
      )
    } else if (ctx.opts.noteInfoGain) {
      ctx.note(attributionScopesInfoGainMsg)
    }
  }

  if (ctx.opts.noteInfoGain) {
    ctx.note(`${numStatesWords}: ${out.numStates}`)
    ctx.note(`randomized trigger rate: ${out.flipProb.toFixed(7)}`)
  }
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

function fullFlexTriggerDatum(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 0, UINT32_MAX)
}

function triggerData(j: Json, ctx: Context): Maybe<Set<number>> {
  return set(j, ctx, fullFlexTriggerDatum, {
    minLength: 0,
    maxLength: constants.maxTriggerDataPerSource,
    requireDistinct: true,
  })
}

function compareNumbers(a: number, b: number): number {
  return a - b
}

function isTriggerDataMatchingValidForSpecs(s: Source, ctx: Context): boolean {
  return ctx.scope('trigger_data_matching', () => {
    if (s.triggerDataMatching !== TriggerDataMatching.modulus) {
      return true
    }

    const triggerData: number[] = Array.from(s.triggerData).sort(compareNumbers)

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
  const hasSpecs = s.triggerData.size > 0

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

function source(j: Json, ctx: Context): Maybe<Source> {
  return object(j, ctx)
    .flatMap((j) => {
      const expiryVal = field(
        'expiry',
        withDefault(expiry, constants.validSourceExpiryRange[1])
      )(j, ctx)

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
          withDefault(
            eventLevelEpsilon,
            ctx.opts.vsv.maxSettableEventLevelEpsilon
          )
        ),
        expiry: () => expiryVal,
        filterData: field('filter_data', withDefault(filterData, new Map())),
        maxEventLevelReports: field(
          'max_event_level_reports',
          maxEventLevelReports
        ),
        sourceEventId: field('source_event_id', withDefault(uint64, 0n)),
        eventReportWindows: exclusive(
          {
            event_report_window: (j) => eventReportWindow(j, ctx, expiryVal),
            event_report_windows: (j) => eventReportWindows(j, ctx, expiryVal),
          },
          expiryVal.map(defaultEventReportWindows, ctx)
        ),

        triggerData: field(
          'trigger_data',
          withDefault(
            triggerData,
            new Set(
              Array.from(
                {
                  length: Number(
                    constants.defaultTriggerDataCardinality[ctx.opts.sourceType]
                  ),
                },
                (_, i) => i
              )
            )
          )
        ),
        aggregatableDebugReporting: field(
          'aggregatable_debug_reporting',
          withDefault(
            withErrorAsWarning(sourceAggregatableDebugReportingConfig, null),
            null
          )
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
        attributionScopes: field(
          'attribution_scopes',
          withDefault(attributionScopes, null)
        ),
        namedBudgets: field(
          'named_budgets',
          withDefault(namedBudgets, new Map())
        ),

        ...commonDebugFields,
        ...priorityField,
      })
    })
    .filter(isTriggerDataMatchingValidForSpecs, ctx)
    .peek(channelCapacity, ctx)
    .peek(warnInconsistentMaxEventLevelReportsAndTriggerSpecs, ctx)
}

function maxEventStates(j: Json, ctx: Context): Maybe<number> {
  return number(j, ctx)
    .filter(isInteger, ctx)
    .filter(isInRange, ctx, 1, ctx.opts.vsv.maxTriggerStateCardinality)
}

function attributionScopesForSource(
  j: Json,
  ctx: Context,
  attributionScopeLimit: Maybe<number>
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
      ctx.error('cannot be fully validated without a valid limit')
      return false
    }
    if (scopes.size === 0) {
      ctx.error('must be non-empty if limit is set')
      return false
    }
    const maxLength = Math.min(
      attributionScopeLimit.value,
      constants.maxAttributionScopesPerSource
    )
    const errorMsg =
      'size must be less than or equal to ' +
      (attributionScopeLimit.value < constants.maxAttributionScopesPerSource
        ? 'limit'
        : 'max number of attribution scopes') +
      ` (${maxLength}) if limit is set`

    return isInRange(scopes.size, ctx, 1, maxLength, errorMsg)
  })
}

function attributionScopes(j: Json, ctx: Context): Maybe<AttributionScopes> {
  return object(j, ctx).flatMap((j) => {
    const limitVal = field('limit', required(positiveUint32))(j, ctx)
    return struct(j, ctx, {
      limit: () => limitVal,
      values: field('values', required(attributionScopesForSource), limitVal),
      maxEventStates: field(
        'max_event_states',
        withDefault(maxEventStates, constants.defaultMaxEventStates)
      ),
    })
  })
}

export function validateSource(
  json: string,
  opts: Readonly<SourceOptions>
): [context.ValidationResult, Maybe<Source>] {
  return validateJSON(
    new RegistrationContext(opts, constants.sourceAggregatableDebugTypes),
    json,
    source
  )
}

export function validator(opts: Readonly<SourceOptions>): Validator<Source> {
  return {
    validate: (input) => validateSource(input, opts),
    serialize: serializeSource,
  }
}
