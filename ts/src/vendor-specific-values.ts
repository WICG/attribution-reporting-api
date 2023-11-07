import { SourceType } from './source-type'

export type VendorSpecificValues = {
  maxEventLevelChannelCapacityPerSource: Record<SourceType, number>
  randomizedResponseEpsilon: number
}

export const Chromium: Readonly<VendorSpecificValues> = {
  maxEventLevelChannelCapacityPerSource: {
    [SourceType.event]: 6.5,
    [SourceType.navigation]: 11.46173,
  },
  randomizedResponseEpsilon: 14,
}
