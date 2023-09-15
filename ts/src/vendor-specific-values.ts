import { SourceType } from './source-type'

export type VendorSpecificValues = {
  defaultEventLevelAttributionsPerSource: Record<SourceType, number>
  maxAggregationKeysPerSource: number
  maxEventLevelChannelCapacityPerSource: Record<SourceType, number>
  randomizedResponseEpsilon: number
  triggerDataCardinality: Record<SourceType, bigint>
}

export const Chromium: Readonly<VendorSpecificValues> = {
  defaultEventLevelAttributionsPerSource: {
    [SourceType.event]: 1,
    [SourceType.navigation]: 3,
  },
  maxAggregationKeysPerSource: 20,
  maxEventLevelChannelCapacityPerSource: {
    [SourceType.event]: 6.5,
    [SourceType.navigation]: 11.46173,
  },
  randomizedResponseEpsilon: 14,
  triggerDataCardinality: {
    [SourceType.event]: 2n,
    [SourceType.navigation]: 8n,
  },
}
