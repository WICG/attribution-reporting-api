import * as reg from './reg'

export type FilterConfig = {
  lookbackWindow: number | null
  map: Map<string, Set<string>>
}

export type FilterPair = {
  positive: FilterConfig[]
  negative: FilterConfig[]
}

export type DedupKey = {
  dedupKey: bigint | null
}

export type AggregatableTriggerDatum = FilterPair &
  reg.KeyPiece & {
    sourceKeys: Set<string>
  }

export type AggregatableValuesValue = {
  value: number
  filteringId: bigint
}

export type AggregatableValues = Map<string, AggregatableValuesValue>

export type AggregatableValuesConfiguration = FilterPair & {
  values: AggregatableValues
}

export type EventTriggerDatum = FilterPair &
  reg.Priority &
  DedupKey & {
    triggerData: bigint
  }

export type AggregatableDedupKey = FilterPair & DedupKey

export type BudgetName = {
  name: string | null
}

export type NamedBudget = FilterPair & BudgetName

export enum AggregatableSourceRegistrationTime {
  exclude = 'exclude',
  include = 'include',
}

export type Trigger = reg.CommonDebug &
  FilterPair &
  reg.AggregationCoordinatorOrigin & {
    aggregatableDedupKeys: AggregatableDedupKey[]
    namedBudgets: NamedBudget[]
    aggregatableTriggerData: AggregatableTriggerDatum[]
    aggregatableSourceRegistrationTime: AggregatableSourceRegistrationTime
    aggregatableFilteringIdMaxBytes: number
    aggregatableValuesConfigurations: AggregatableValuesConfiguration[]
    eventTriggerData: EventTriggerDatum[]
    triggerContextID: string | null
    aggregatableDebugReporting: reg.AggregatableDebugReportingConfig | null
    attributionScopes: Set<string>
  }
