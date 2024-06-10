import * as parsed from './validate-json'

type MaybeHasField<K extends string, V> = {
  [key in K]?: V
}

function ifNotNull<K extends string, U, V>(
  key: K,
  u: U | null,
  f: (u: U) => V
): MaybeHasField<K, V> {
  const obj: MaybeHasField<K, V> = {}
  if (u !== null) {
    obj[key] = f(u)
  }
  return obj
}

export type CommonDebug = {
  debug_key?: string
  debug_reporting: boolean
}

function serializeCommonDebug(c: parsed.CommonDebug): CommonDebug {
  return {
    ...ifNotNull('debug_key', c.debugKey, (v) => v.toString()),
    debug_reporting: c.debugReporting,
  }
}

export type Priority = {
  priority: string
}

function serializePriority(p: parsed.Priority): Priority {
  return { priority: p.priority.toString() }
}

export type KeyPiece = {
  key_piece: string
}

function serializeKeyPiece(p: parsed.KeyPiece): KeyPiece {
  return { key_piece: `0x${p.keyPiece.toString(16)}` }
}

export type AggregatableDebugReportingData = KeyPiece & {
  types: string[]
  value: number
}

function serializeAggregatableDebugReportingData(
  d: parsed.AggregatableDebugReportingData
): AggregatableDebugReportingData {
  return {
    ...serializeKeyPiece(d),

    types: Array.from(d.types),
    value: d.value,
  }
}

export type AggregatableDebugReportingConfig = KeyPiece & {
  aggregation_coordinator_origin: string
  debug_data: AggregatableDebugReportingData[]
}

function serializeAggregatableDebugReportingConfig(
  d: parsed.AggregatableDebugReportingConfig
): AggregatableDebugReportingConfig {
  return {
    ...serializeKeyPiece(d),

    aggregation_coordinator_origin: d.aggregationCoordinatorOrigin,
    debug_data: Array.from(
      d.debugData,
      serializeAggregatableDebugReportingData
    ),
  }
}

export type EventReportWindows = {
  event_report_windows: { start_time: number; end_times: number[] }
}

function serializeEventReportWindows(
  e: parsed.EventReportWindows
): EventReportWindows {
  return {
    event_report_windows: {
      start_time: e.startTime,
      end_times: [...e.endTimes],
    },
  }
}

export type TriggerData = {
  trigger_data: number[]
}

function serializeTriggerData(d: Set<number>): TriggerData {
  return { trigger_data: Array.from(d) }
}

export type TriggerSpec = EventReportWindows &
  TriggerData & {
    summary_buckets: number[]
    summary_window_operator: string
  }

function serializeTriggerSpec(ts: parsed.TriggerSpec): TriggerSpec {
  return {
    ...serializeEventReportWindows(ts.eventReportWindows),
    ...serializeTriggerData(ts.triggerData),

    summary_buckets: Array.from(ts.summaryBuckets),
    summary_window_operator: ts.summaryWindowOperator,
  }
}

export type SourceAggregatableDebugReportingConfig =
  AggregatableDebugReportingConfig & {
    budget: number
  }

function serializeSourceAggregatableDebugReportingConfig(
  d: parsed.SourceAggregatableDebugReportingConfig
): SourceAggregatableDebugReportingConfig {
  return {
    ...serializeAggregatableDebugReportingConfig(d),

    budget: d.budget,
  }
}

export type NotFullFlexSource = Partial<EventReportWindows> & {
  trigger_data: number[]
  trigger_specs?: never
}

export type FullFlexSource = {
  event_report_windows?: never
  trigger_data?: never
  trigger_specs: TriggerSpec[]
}

function serializeFlexSource(
  s: parsed.Source,
  fullFlex: boolean
): NotFullFlexSource | FullFlexSource {
  if (fullFlex) {
    return {
      trigger_specs: Array.from(s.triggerSpecs, serializeTriggerSpec),
    }
  }

  if (s.triggerSpecs.length === 0) {
    return { trigger_data: [] }
  }

  if (s.triggerSpecs.length === 1) {
    return {
      ...serializeEventReportWindows(s.triggerSpecs[0]!.eventReportWindows),
      ...serializeTriggerData(s.triggerSpecs[0]!.triggerData),
    }
  }

  throw new TypeError()
}

export type Source = CommonDebug &
  Priority &
  (NotFullFlexSource | FullFlexSource) & {
    aggregation_keys: { [key: string]: string }
    aggregatable_report_window: number
    destination: string[]
    destination_limit_priority: string
    event_level_epsilon: number
    expiry: number
    filter_data: { [key: string]: string[] }
    max_event_level_reports: number
    source_event_id: string
    trigger_data_matching: string
    aggregatable_debug_reporting?: SourceAggregatableDebugReportingConfig
  }

export function serializeSource(s: parsed.Source, fullFlex: boolean): Source {
  return {
    ...serializeCommonDebug(s),
    ...serializePriority(s),
    ...serializeFlexSource(s, fullFlex),

    aggregation_keys: Object.fromEntries(
      Array.from(s.aggregationKeys.entries(), ([key, val]) => [
        key,
        `0x${val.toString(16)}`,
      ])
    ),

    filter_data: Object.fromEntries(
      Array.from(s.filterData.entries(), ([key, vals]) => [
        key,
        Array.from(vals),
      ])
    ),

    aggregatable_report_window: s.aggregatableReportWindow,
    destination: Array.from(s.destination),
    destination_limit_priority: s.destinationLimitPriority.toString(),
    event_level_epsilon: s.eventLevelEpsilon,
    expiry: s.expiry,
    max_event_level_reports: s.maxEventLevelReports,
    source_event_id: s.sourceEventId.toString(),
    trigger_data_matching: s.triggerDataMatching,
    ...ifNotNull(
      'aggregatable_debug_reporting',
      s.aggregatableDebugReporting,
      (v) => serializeSourceAggregatableDebugReportingConfig(v)
    ),
  }
}

export type FilterConfig = {
  [key: string]: number | string[]
}

function serializeFilterConfig(fc: parsed.FilterConfig): FilterConfig {
  const obj: FilterConfig = Object.fromEntries(
    Array.from(fc.map.entries(), ([key, vals]) => [key, Array.from(vals)])
  )

  if (fc.lookbackWindow !== null) {
    obj['_lookback_window'] = fc.lookbackWindow
  }

  return obj
}

export type FilterPair = {
  filters: FilterConfig[]
  not_filters: FilterConfig[]
}

function serializeFilterPair(fp: parsed.FilterPair): FilterPair {
  return {
    filters: Array.from(fp.positive, serializeFilterConfig),
    not_filters: Array.from(fp.negative, serializeFilterConfig),
  }
}

export type DedupKey = {
  deduplication_key?: string
}

function serializeDedupKey(fp: parsed.DedupKey): DedupKey {
  return ifNotNull('deduplication_key', fp.dedupKey, (v) => v.toString())
}

export type EventTriggerDatum = FilterPair &
  Priority &
  DedupKey & {
    trigger_data: string
    value?: number
  }

function serializeEventTriggerDatum(
  d: parsed.EventTriggerDatum,
  fullFlex: boolean
): EventTriggerDatum {
  const obj: EventTriggerDatum = {
    ...serializeFilterPair(d),
    ...serializePriority(d),
    ...serializeDedupKey(d),

    trigger_data: d.triggerData.toString(),
  }

  if (fullFlex) {
    obj.value = d.value
  }

  return obj
}

export type AggregatableDedupKey = FilterPair & DedupKey

function serializeAggregatableDedupKey(
  d: parsed.AggregatableDedupKey
): AggregatableDedupKey {
  return {
    ...serializeFilterPair(d),
    ...serializeDedupKey(d),
  }
}

export type AggregatableTriggerDatum = FilterPair &
  KeyPiece & {
    source_keys: string[]
  }

function serializeAggregatableTriggerDatum(
  d: parsed.AggregatableTriggerDatum
): AggregatableTriggerDatum {
  return {
    ...serializeFilterPair(d),
    ...serializeKeyPiece(d),

    source_keys: Array.from(d.sourceKeys),
  }
}

export type AggregatableValuesConfiguration = FilterPair & {
  values: { [key: string]: number }
}

function serializeAggregatableValuesConfiguration(
  c: parsed.AggregatableValuesConfiguration
): AggregatableValuesConfiguration {
  return {
    ...serializeFilterPair(c),

    values: Object.fromEntries(c.values.entries()),
  }
}

export type Trigger = CommonDebug &
  FilterPair & {
    aggregatable_deduplication_keys: AggregatableDedupKey[]
    aggregatable_source_registration_time: string
    aggregatable_trigger_data: AggregatableTriggerDatum[]
    aggregatable_values: AggregatableValuesConfiguration[]
    aggregation_coordinator_origin: string
    event_trigger_data: EventTriggerDatum[]
    trigger_context_id?: string
    aggregatable_debug_reporting?: AggregatableDebugReportingConfig
  }

export function serializeTrigger(
  t: parsed.Trigger,
  fullFlex: boolean
): Trigger {
  return {
    ...serializeCommonDebug(t),
    ...serializeFilterPair(t),

    aggregatable_deduplication_keys: Array.from(
      t.aggregatableDedupKeys,
      serializeAggregatableDedupKey
    ),

    aggregatable_source_registration_time: t.aggregatableSourceRegistrationTime,

    aggregatable_trigger_data: Array.from(
      t.aggregatableTriggerData,
      serializeAggregatableTriggerDatum
    ),

    aggregatable_values: Array.from(
      t.aggregatableValuesConfigurations,
      serializeAggregatableValuesConfiguration
    ),

    aggregation_coordinator_origin: t.aggregationCoordinatorOrigin,

    event_trigger_data: Array.from(t.eventTriggerData, (d) =>
      serializeEventTriggerDatum(d, fullFlex)
    ),

    ...ifNotNull('trigger_context_id', t.triggerContextID, (v) => v),

    ...ifNotNull(
      'aggregatable_debug_reporting',
      t.aggregatableDebugReporting,
      (v) => serializeAggregatableDebugReportingConfig(v)
    ),
  }
}
