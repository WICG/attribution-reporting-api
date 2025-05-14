import * as reg from './reg'

export type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

export type FilterData = Map<string, Set<string>>

export type AggregationKeys = Map<string, bigint>
export type NamedBudgets = Map<string, number>

export type SourceAggregatableDebugReportingConfig =
  reg.AggregatableDebugReportingConfig & {
    budget: number
  }

export enum TriggerDataMatching {
  exact = 'exact',
  modulus = 'modulus',
}

export type AttributionScopes = {
  limit: number
  values: Set<string>
  maxEventStates: number
}

export type Source = reg.CommonDebug &
  reg.Priority & {
    aggregatableReportWindow: number
    aggregationKeys: AggregationKeys
    namedBudgets: NamedBudgets
    destination: Set<string>
    expiry: number
    filterData: FilterData
    maxEventLevelReports: number
    sourceEventId: bigint

    eventReportWindows: EventReportWindows
    triggerData: Set<number>
    triggerDataMatching: TriggerDataMatching

    eventLevelEpsilon: number
    aggregatableDebugReporting: SourceAggregatableDebugReportingConfig | null
    destinationLimitPriority: bigint
    attributionScopes: AttributionScopes | null
  }
