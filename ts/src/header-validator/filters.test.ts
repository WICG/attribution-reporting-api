import { strict as assert } from 'assert'
import test from 'node:test'
import { SourceType } from '../source-type'
import * as filters from './filters'
import { FilterData } from './source'
import { FilterConfig } from './trigger'

type TestCase = {
  name: string

  sourceData?: FilterData
  sourceType?: SourceType
  filters: FilterConfig[]

  expectedPositive: boolean
  expectedNegative: boolean
}

const sourceTime = 1
const triggerTime = sourceTime + 5

const testCases: TestCase[] = [
  {
    name: 'empty',
    filters: [],
    expectedPositive: true,
    expectedNegative: true,
  },

  {
    name: 'key-in-source-not-trigger',
    sourceData: new Map([['x', new Set()]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map(),
      },
    ],
    expectedPositive: true,
    expectedNegative: true,
  },
  {
    name: 'key-in-trigger-not-source',
    sourceData: new Map(),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set()]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: true,
  },
  {
    name: 'key-in-both-empty',
    sourceData: new Map([['x', new Set()]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set()]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },
  {
    name: 'key-in-both-value-contained',
    sourceData: new Map([['x', new Set(['1', '2'])]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['2', '4'])]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },
  {
    name: 'key-in-both-value-not-contained',
    sourceData: new Map([['x', new Set(['1', '2'])]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['3'])]]),
      },
    ],
    expectedPositive: false,
    expectedNegative: true,
  },

  {
    name: 'source_type-navigation',
    sourceType: SourceType.navigation,
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['source_type', new Set(['navigation'])]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },
  {
    name: 'source_type-event',
    sourceType: SourceType.event,
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['source_type', new Set(['event'])]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },

  {
    name: 'disjunction-match',
    sourceData: new Map([['x', new Set(['y'])]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['z'])]]),
      },
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['y'])]]),
      },
    ],
    expectedPositive: true,
    expectedNegative: true,
  },
  {
    name: 'disjunction-no-match',
    sourceData: new Map([['x', new Set(['w'])]]),
    filters: [
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['z'])]]),
      },
      {
        lookbackWindow: null,
        map: new Map([['x', new Set(['y'])]]),
      },
    ],
    expectedPositive: false,
    expectedNegative: true,
  },

  {
    name: 'lookback-lt',
    filters: [
      {
        lookbackWindow: triggerTime - sourceTime + 1,
        map: new Map(),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },
  {
    name: 'lookback-eq',
    filters: [
      {
        lookbackWindow: triggerTime - sourceTime,
        map: new Map(),
      },
    ],
    expectedPositive: true,
    expectedNegative: false,
  },
  {
    name: 'lookback-gt',
    filters: [
      {
        lookbackWindow: triggerTime - sourceTime - 1,
        map: new Map(),
      },
    ],
    expectedPositive: false,
    expectedNegative: true,
  },
]

testCases.forEach((tc) => {
  const sourceData = tc.sourceData ?? new Map<string, Set<string>>()
  const sourceType = tc.sourceType ?? SourceType.navigation

  void test(`${tc.name}-positive`, () => {
    const actual = filters.match(
      sourceTime,
      sourceData,
      sourceType,
      {
        positive: tc.filters,
        negative: [],
      },
      triggerTime
    )
    assert.equal(actual, tc.expectedPositive)
  })

  void test(`${tc.name}-negative`, () => {
    const actual = filters.match(
      sourceTime,
      sourceData,
      sourceType,
      {
        positive: [],
        negative: tc.filters,
      },
      triggerTime
    )
    assert.equal(actual, tc.expectedNegative)
  })
})
