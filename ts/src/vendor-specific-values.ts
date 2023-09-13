import { SourceType } from './source-type'

export type VendorSpecificValues = {
  defaultEventLevelAttributionsPerSource: Record<SourceType, number>
  maxAggregationKeysPerAttribution: number
  triggerDataCardinality: Record<SourceType, bigint>
}

export const Chromium: Readonly<VendorSpecificValues> = {
  defaultEventLevelAttributionsPerSource: {
    [SourceType.event]: 1,
    [SourceType.navigation]: 3,
  },
  maxAggregationKeysPerAttribution: 20,
  triggerDataCardinality: {
    [SourceType.event]: 2n,
    [SourceType.navigation]: 8n,
  },
}
