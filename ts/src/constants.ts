// https://wicg.github.io/attribution-reporting-api/#constants

import { SourceType } from './source-type'

export const SECONDS_PER_HOUR: number = 60 * 60
export const SECONDS_PER_DAY: number = 24 * SECONDS_PER_HOUR

export const maxSettableEventLevelAttributionsPerSource: number = 20

export const maxEntriesPerFilterData: number = 50

export const maxValuesPerFilterDataEntry: number = 50

export const maxLengthPerFilterString: number = 25

export const maxAggregationKeysPerSource: number = 20

export const maxLengthPerAggregationKeyIdentifier: number = 25

export const minReportWindow: number = 1 * SECONDS_PER_HOUR

export const validSourceExpiryRange: Readonly<[min: number, max: number]> = [
  1 * SECONDS_PER_DAY,
  30 * SECONDS_PER_DAY,
]

export const defaultEarlyEventLevelReportWindows: Readonly<
  Record<SourceType, readonly number[]>
> = {
  [SourceType.event]: [],
  [SourceType.navigation]: [2 * SECONDS_PER_DAY, 7 * SECONDS_PER_DAY],
}

export const defaultEventLevelAttributionsPerSource: Readonly<
  Record<SourceType, number>
> = {
  [SourceType.event]: 1,
  [SourceType.navigation]: 3,
}

export const maxTriggerDataPerSource: number = 32

export const allowedAggregatableBudgetPerSource: number = 65536

export const defaultTriggerDataCardinality: Readonly<
  Record<SourceType, bigint>
> = {
  [SourceType.event]: 2n,
  [SourceType.navigation]: 8n,
}
