import { SourceType } from '../source-type'
import { FilterData } from './source'
import { FilterConfig, FilterPair } from './trigger'

// https://wicg.github.io/attribution-reporting-api/#does-filter-data-match
function matchFilterValues(a: Set<string>, b: Set<string>): boolean {
  if (b.size === 0) {
    if (a.size === 0) {
      return true
    }
    return false
  }

  for (const ia of a) {
    if (b.has(ia)) {
      return true
    }
  }
  return false
}

// https://wicg.github.io/attribution-reporting-api/#match-filter-values-with-negation
function matchFilterValuesWithNegation(
  a: Set<string>,
  b: Set<string>
): boolean {
  if (b.size === 0) {
    if (a.size > 0) {
      return true
    }
    return false
  }

  for (const ia of a) {
    if (b.has(ia)) {
      return false
    }
  }
  return true
}

// https://wicg.github.io/attribution-reporting-api/#match-an-attribution-source-against-a-filter-config
function matchSourceAgainstFilterConfig(
  sourceTime: number,
  sourceData: FilterData,
  { lookbackWindow, map: filterMap }: FilterConfig,
  moment: number,
  isNegated: boolean
): boolean {
  if (lookbackWindow !== null) {
    if (moment - sourceTime > lookbackWindow) {
      if (!isNegated) {
        return false
      }
    } else if (isNegated) {
      return false
    }
  }

  for (const [key, filterValues] of filterMap) {
    const sourceValues = sourceData.get(key)
    if (sourceValues === undefined) {
      continue
    }
    if (!isNegated) {
      if (!matchFilterValues(sourceValues, filterValues)) {
        return false
      }
    } else {
      if (!matchFilterValuesWithNegation(sourceValues, filterValues)) {
        return false
      }
    }
  }

  return true
}

// https://wicg.github.io/attribution-reporting-api/#match-an-attribution-source-against-filters
function matchSourceAgainstFilters(
  sourceTime: number,
  sourceData: FilterData,
  filters: FilterConfig[],
  moment: number,
  isNegated: boolean
): boolean {
  if (filters.length === 0) {
    return true
  }

  for (const filter of filters) {
    if (
      matchSourceAgainstFilterConfig(
        sourceTime,
        sourceData,
        filter,
        moment,
        isNegated
      )
    ) {
      return true
    }
  }
  return false
}

// https://wicg.github.io/attribution-reporting-api/#match-an-attribution-source-against-filters-and-negated-filters
function matchSourceAgainstFiltersAndNegatedFilters(
  sourceTime: number,
  sourceData: FilterData,
  { positive: filters, negative: notFilters }: FilterPair,
  moment: number
): boolean {
  if (
    !matchSourceAgainstFilters(
      sourceTime,
      sourceData,
      filters,
      moment,
      /*isNegated=*/ false
    )
  ) {
    return false
  }

  if (
    !matchSourceAgainstFilters(
      sourceTime,
      sourceData,
      notFilters,
      moment,
      /*isNegated=*/ true
    )
  ) {
    return false
  }
  return true
}

export function match(
  sourceTime: number,
  sourceData: FilterData,
  sourceType: SourceType,
  fp: FilterPair,
  moment: number
): boolean {
  sourceData = new Map(sourceData)
  sourceData.set('source_type', new Set([sourceType]))
  return matchSourceAgainstFiltersAndNegatedFilters(
    sourceTime,
    sourceData,
    fp,
    moment
  )
}
