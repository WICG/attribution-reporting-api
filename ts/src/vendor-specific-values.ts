import { SourceType } from './source-type'

export type VendorSpecificValues = {
  maxAggregationKeysPerSource: number
  maxEventLevelChannelCapacityPerSource: Record<SourceType, number>
  randomizedResponseEpsilon: number
}

export const Chromium: Readonly<VendorSpecificValues> = {
  maxAggregationKeysPerSource: 20,
  maxEventLevelChannelCapacityPerSource: {
    [SourceType.event]: 6.5,
    [SourceType.navigation]: 11.46173,
  },
  randomizedResponseEpsilon: 14,
}
