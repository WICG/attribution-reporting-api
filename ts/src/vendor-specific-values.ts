import { SourceType } from './source-type'

export type VendorSpecificValues = {
  // The first value is the default if a trigger doesn't specify one.
  aggregationCoordinatorOrigins: [string, ...string[]]
  maxEventLevelChannelCapacityPerSource: Record<SourceType, number>
  maxSettableEventLevelEpsilon: number
  maxTriggerStateCardinality: number
}

export const Chromium: Readonly<VendorSpecificValues> = {
  aggregationCoordinatorOrigins: [
    'https://publickeyservice.msmt.aws.privacysandboxservices.com',
    'https://publickeyservice.msmt.gcp.privacysandboxservices.com',
  ],
  maxEventLevelChannelCapacityPerSource: {
    [SourceType.event]: 6.5,
    [SourceType.navigation]: 11.5,
  },
  maxSettableEventLevelEpsilon: 14,
  maxTriggerStateCardinality: 2 ** 32 - 1,
}
