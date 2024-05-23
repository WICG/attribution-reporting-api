import { SourceType } from '../source-type'
import * as filters from './filters'
import {
  AggregatableTriggerDatum,
  AggregatableValues,
  AggregatableValuesConfiguration,
  AggregationKeys,
  FilterData,
} from './validate-json'

export type AggregatableContribution = {
  key: bigint
  value: number
  filteringId: bigint
}

// https://wicg.github.io/attribution-reporting-api/#create-aggregatable-contributions-from-aggregation-keys-and-aggregatable-values
function createAggregatableContributionsFromKeysAndValues(
  aggregationKeys: AggregationKeys,
  aggregatableValues: AggregatableValues
): AggregatableContribution[] {
  const contributions = []
  for (const [id, key] of aggregationKeys) {
    const value = aggregatableValues.get(id)
    if (value === undefined) {
      continue
    }
    contributions.push({ key, ...value })
  }
  return contributions
}

// https://wicg.github.io/attribution-reporting-api/#create-aggregatable-contributions
export function createAggregatableContributions(
  filterData: FilterData,
  sourceType: SourceType,
  sourceTime: number,
  triggerTime: number,
  aggregationKeys: AggregationKeys,
  aggregatableTriggerData: readonly AggregatableTriggerDatum[],
  aggregatableValuesConfigurations: readonly AggregatableValuesConfiguration[]
): AggregatableContribution[] {
  aggregationKeys = new Map(aggregationKeys)

  for (const triggerData of aggregatableTriggerData) {
    if (
      !filters.match(
        sourceTime,
        filterData,
        sourceType,
        triggerData,
        triggerTime
      )
    ) {
      continue
    }

    for (const sourceKey of triggerData.sourceKeys) {
      const value = aggregationKeys.get(sourceKey)
      if (value == undefined) {
        continue
      }
      aggregationKeys.set(sourceKey, value | triggerData.keyPiece)
    }
  }

  for (const aggregatableValuesConfiguration of aggregatableValuesConfigurations) {
    if (
      filters.match(
        sourceTime,
        filterData,
        sourceType,
        aggregatableValuesConfiguration,
        triggerTime
      )
    ) {
      return createAggregatableContributionsFromKeysAndValues(
        aggregationKeys,
        aggregatableValuesConfiguration.values
      )
    }
  }

  return []
}
