import * as constants from '../constants'
import { SourceType } from '../source-type'
import * as context from './context'
import { Maybe } from './maybe'
import { serializeTrigger } from './to-json'
import {
  AggregatableDedupKey,
  AggregatableSourceRegistrationTime,
  AggregatableTriggerDatum,
  AggregatableValues,
  AggregatableValuesConfiguration,
  AggregatableValuesValue,
  DedupKey,
  EventTriggerDatum,
  FilterConfig,
  FilterPair,
  Trigger,
} from './trigger'
import { isInteger, isInRange, required, withDefault } from './validate'
import { Validator } from './validator'
import {
  Json,
  RegistrationContext as Context,
  RegistrationOptions,
  StructFields,
  UINT32_MAX,
  aggregatableDebugReportingConfig,
  aggregatableKeyValueValue,
  aggregationCoordinatorOriginField,
  aggregationKeyIdentifierLength,
  array,
  commonDebugFields,
  enumerated,
  field,
  keyPieceField,
  keyValues,
  number,
  object,
  positiveInteger,
  priorityField,
  set,
  string,
  struct,
  typeSwitch,
  uint,
  uint64,
  validateJSON,
} from './validate-json'

function filterKeyValue(
  [key, j]: [string, Json],
  ctx: context.Context
): Maybe<Set<string>> {
  if (key.startsWith('_')) {
    ctx.error('is prohibited as keys starting with "_" are reserved')
    return Maybe.None
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

function filterConfig(j: Json, ctx: context.Context): Maybe<FilterConfig> {
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

function orFilters(j: Json, ctx: context.Context): Maybe<FilterConfig[]> {
  return typeSwitch(j, ctx, {
    list: (j) => array(j, ctx, filterConfig),
    object: (j) => filterConfig(j, ctx).map((v) => [v]),
  })
}

const filterFields: StructFields<FilterPair> = {
  positive: field('filters', withDefault(orFilters, [])),
  negative: field('not_filters', withDefault(orFilters, [])),
}

export function filterPair(j: Json, ctx: context.Context): Maybe<FilterPair> {
  return struct(j, ctx, filterFields)
}

const dedupKeyField: StructFields<DedupKey, Context> = {
  dedupKey: field('deduplication_key', withDefault(uint64, null)),
}

function sourceKeys(j: Json, ctx: Context): Maybe<Set<string>> {
  return set(j, ctx, (j) =>
    string(j, ctx).filter(aggregationKeyIdentifierLength, ctx)
  )
}

function aggregatableTriggerData(
  j: Json,
  ctx: Context
): Maybe<AggregatableTriggerDatum[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      sourceKeys: field('source_keys', withDefault(sourceKeys, new Set())),
      ...filterFields,
      ...keyPieceField,
    })
  )
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
    return Maybe.None
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

function eventTriggerValue(j: Json, ctx: Context): Maybe<number> {
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

function eventTriggerData(j: Json, ctx: Context): Maybe<EventTriggerDatum[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      triggerData: field('trigger_data', withDefault(uint64, 0n)),

      value: ctx.opts.fullFlex
        ? field('value', withDefault(eventTriggerValue, 1))
        : () => Maybe.some(1),

      ...filterFields,
      ...dedupKeyField,
      ...priorityField,
    })
  )
}

function aggregatableDedupKeys(
  j: Json,
  ctx: Context
): Maybe<AggregatableDedupKey[]> {
  return array(j, ctx, (j) =>
    struct(j, ctx, {
      ...dedupKeyField,
      ...filterFields,
    })
  )
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

function trigger(j: Json, ctx: Context): Maybe<Trigger> {
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
        attributionScopes: ctx.opts.scopes
          ? field(
              'attribution_scopes',
              withDefault(set, new Set<string>()),
              string
            )
          : () => Maybe.some(new Set<string>()),
        ...aggregationCoordinatorOriginField,
        ...commonDebugFields,
        ...filterFields,
      })
    })
    .peek(warnInconsistentAggregatableKeys, ctx)
}

function validateTrigger(
  json: string,
  opts: Readonly<RegistrationOptions>
): [context.ValidationResult, Maybe<Trigger>] {
  return validateJSON(
    new Context(opts, constants.triggerAggregatableDebugTypes),
    json,
    trigger
  )
}

export function validator(
  opts: Readonly<RegistrationOptions>
): Validator<Trigger> {
  return {
    validate: (input) => validateTrigger(input, opts),
    serialize: (value) => serializeTrigger(value, opts),
  }
}
