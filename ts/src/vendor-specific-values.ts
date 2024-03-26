import { SourceType } from './source-type'

export type VendorSpecificValues = {
  maxEventLevelChannelCapacityPerSource: Record<SourceType, number>
  maxSettableEventLevelEpsilon: number
  maxTriggerStateCardinality: number
}

export const Chromium: Readonly<VendorSpecificValues> = {
  maxEventLevelChannelCapacityPerSource: {
    [SourceType.event]: 6.5,
    [SourceType.navigation]: 11.5,
  },
  maxSettableEventLevelEpsilon: 14,
  maxTriggerStateCardinality: Infinity,
}
