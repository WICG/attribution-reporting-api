import { strict as assert } from 'assert'
import test from 'node:test'
import { SourceType } from '../source-type'
import { createAggregatableContributions } from './aggregatable-contributions'
import {
  AggregatableTriggerDatum,
  AggregatableValuesConfiguration,
  AggregationKeys,
  FilterData,
} from './validate-json'

const sourceTime = 1
const triggerTime = sourceTime + 5

void test('basic', () => {
  const filterData: FilterData = new Map([['filter', new Set(['value'])]])

  const aggregationKeys: AggregationKeys = new Map([
    ['key1', 345n],
    ['key2', 5n],
    ['key3', 123n],
  ])

  const aggregatableTriggerData: AggregatableTriggerDatum[] = [
    // Applies to key1, key3
    {
      keyPiece: 1024n,
      sourceKeys: new Set(['key1', 'key3']),
      positive: [
        {
          map: new Map([['filter', new Set(['value'])]]),
          lookbackWindow: null,
        },
      ],
      negative: [],
    },
    // Applies to key2; key4 is ignored
    {
      keyPiece: 2688n,
      sourceKeys: new Set(['key2', 'key4']),
      positive: [
        {
          map: new Map([['a', new Set(['b', 'c'])]]),
          lookbackWindow: null,
        },
      ],
      negative: [],
    },
    // Ignored due to mismatched filters
    {
      keyPiece: 4096n,
      sourceKeys: new Set(['key1', 'key2']),
      positive: [
        {
          map: new Map([['filter', new Set()]]),
          lookbackWindow: null,
        },
      ],
      negative: [],
    },
    // Ignored due to mismatched negative filters
    {
      keyPiece: 4096n,
      sourceKeys: new Set(['key1', 'key2']),
      positive: [],
      negative: [
        {
          map: new Map([['filter', new Set(['value'])]]),
          lookbackWindow: null,
        },
      ],
    },
    // Ignored due to mismatched lookback window
    {
      keyPiece: 4096n,
      sourceKeys: new Set(['key1', 'key3']),
      positive: [
        {
          map: new Map([['filter', new Set(['value'])]]),
          lookbackWindow: 4.9,
        },
      ],
      negative: [],
    },
  ]

  const aggregatableValuesCfgs: AggregatableValuesConfiguration[] = [
    {
      values: new Map([
        ['key1', { value: 32768, filteringId: 25n }],
        ['key2', { value: 1664, filteringId: 0n }],
      ]),
      positive: [],
      negative: [],
    },
  ]

  const actual = createAggregatableContributions(
    filterData,
    SourceType.event,
    sourceTime,
    triggerTime,
    aggregationKeys,
    aggregatableTriggerData,
    aggregatableValuesCfgs
  )
  assert.deepEqual(actual, [
    // key3 is not present as no value is found
    {
      key: 1369n,
      value: 32768,
      filteringId: 25n,
    },
    {
      key: 2693n,
      value: 1664,
      filteringId: 0n,
    },
  ])
})

void test('values-filtered', async (t) => {
  const filterData: FilterData = new Map([['product', new Set(['1'])]])

  const aggregationKeys: AggregationKeys = new Map([
    ['key1', 345n],
    ['key2', 5n],
  ])

  const aggregatableTriggerData: AggregatableTriggerDatum[] = [
    {
      keyPiece: 1024n,
      sourceKeys: new Set(['key1', 'key2']),
      positive: [],
      negative: [],
    },
  ]

  const createWith = (
    aggregatableValuesCfgs: AggregatableValuesConfiguration[]
  ) =>
    createAggregatableContributions(
      filterData,
      SourceType.event,
      sourceTime,
      triggerTime,
      aggregationKeys,
      aggregatableTriggerData,
      aggregatableValuesCfgs
    )

  await t.test('filter-not-matching', () =>
    assert.deepEqual(
      createWith([
        {
          values: new Map([['key1', { value: 32768, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['2'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
      ]),
      []
    )
  )

  await t.test('first-entry-skipped', () =>
    assert.deepEqual(
      createWith([
        {
          values: new Map([['key1', { value: 32768, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['2'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
        {
          values: new Map([['key2', { value: 1664, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
      ]),
      [{ key: 1029n, value: 1664, filteringId: 0n }]
    )
  )

  await t.test('second-entry-ignored', () =>
    assert.deepEqual(
      createWith([
        {
          values: new Map([['key1', { value: 32768, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
        {
          values: new Map([['key2', { value: 1664, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
      ]),
      [{ key: 1369n, value: 32768, filteringId: 0n }]
    )
  )

  await t.test('filters-matched-keys-mismatched-no-contributions', () =>
    assert.deepEqual(
      createWith([
        {
          values: new Map([['key3', { value: 32768, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
        // Shouldn't contribute as only the first aggregatable values
        // entry with matching filters is considered
        {
          values: new Map([['key2', { value: 1664, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
      ]),
      []
    )
  )

  await t.test('not-filter-matching-first-entry-skipped', () =>
    assert.deepEqual(
      createWith([
        {
          values: new Map([['key1', { value: 32768, filteringId: 0n }]]),
          positive: [],
          negative: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
        },
        {
          values: new Map([['key2', { value: 1664, filteringId: 0n }]]),
          positive: [
            {
              map: new Map([['product', new Set(['1'])]]),
              lookbackWindow: null,
            },
          ],
          negative: [],
        },
      ]),
      [{ key: 1029n, value: 1664, filteringId: 0n }]
    )
  )
})
