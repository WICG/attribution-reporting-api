import * as reg from './reg'

export type EventReportWindows = {
  startTime: number
  endTimes: number[]
}

export type FilterData = Map<string, Set<string>>

export type AggregationKeys = Map<string, bigint>

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
  reg.AggregatableDebugReportingConfig & {
    budget: number
  }

export enum TriggerDataMatching {
  exact = 'exact',
  modulus = 'modulus',
}

export type AttributionScopeData = {
  attributionScopeLimit: number
  attributionScopes: Set<string>
  maxEventStates: number
}

export type Source = reg.CommonDebug &
  reg.Priority & {
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
    attributionScopeData: AttributionScopeData | null
  }
