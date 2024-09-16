import assert from 'node:assert/strict'
import test from 'node:test'
import * as constants from '../constants'
import { SourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import {
  Config,
  PerTriggerDataConfig,
  binaryEntropy,
  flipProbabilityDp,
  maxInformationGain,
  epsilonToBoundInfoGainAndDp,
  epsilonToBoundInfoGainAndDpBinarySearch,
} from './privacy'

const flipProbabilityTests = [
  {
    numStates: 2,
    epsilon: Math.log(3),
    expected: 0.5,
  },
  {
    numStates: 3,
    epsilon: Math.log(3),
    expected: 0.6,
  },
  {
    numStates: 2925,
    epsilon: 14,
    expected: 0.0024263221679834087,
  },
  {
    numStates: 3,
    epsilon: 14,
    expected: 0.000002494582008677539,
  },
]

void test('flipProbabilityDp', async (t) => {
  await Promise.all(
    flipProbabilityTests.map((tc, i) =>
      t.test(`${i}`, () => {
        const actual = flipProbabilityDp(tc.numStates, tc.epsilon)
        assert.deepStrictEqual(actual, tc.expected)
      })
    )
  )
})

const infoGainTests = [
  {
    numStates: 2,
    epsilon: Infinity,
    expected: 1,
  },
  {
    numStates: 1024,
    epsilon: Infinity,
    expected: Math.log2(1024),
  },
  {
    numStates: 3,
    epsilon: Infinity,
    expected: Math.log2(3),
  },
  {
    numStates: 2,
    epsilon: Math.log(3),
    expected: 0.18872187554086717,
  },
  {
    numStates: 2925,
    epsilon: 14,
    expected: 11.461727965384876,
  },
  {
    numStates: 3,
    epsilon: 14,
    expected: 1.584926511508231,
  },
  {
    numStates: 1,
    epsilon: 14,
    expected: 0,
  },
  {
    numStates: 2925,
    epsilon: 14,
    attributionScopeLimit: 101,
    maxEventStates: 10,
    expected: 11.461727965384876,
  },
]

void test('maxInformationGain', async (t) => {
  await Promise.all(
    infoGainTests.map((tc, i) =>
      t.test(`${i}`, () => {
        const actual = maxInformationGain(tc.numStates, tc.epsilon)
        assert.deepStrictEqual(actual, tc.expected)
      })
    )
  )
})

void test('epsilonToBoundInfoGainAndDp', async (t) => {
  const infoGainUppers = [11.5, 6.5]
  const epsilonUpper = 14
  const numStatesRange = 100000
  const numTests = 500

  await Promise.all(
    [...Array(numTests).keys()].map((i) =>
      t.test(`${i}`, () => {
        const numStates = Math.ceil(Math.random() * numStatesRange)
        const infoGainUpper = infoGainUppers[Math.round(Math.random())]!

        const epsilonByBinarySearch = epsilonToBoundInfoGainAndDpBinarySearch(
          numStates,
          infoGainUpper,
          epsilonUpper,
          1e-14
        )

        const epsilonByBitSearch = epsilonToBoundInfoGainAndDp(
          numStates,
          infoGainUpper,
          epsilonUpper
        )

        assert(epsilonByBitSearch >= epsilonByBinarySearch)
        assert(
          maxInformationGain(numStates, epsilonByBitSearch) <= infoGainUpper
        )
        if (epsilonByBitSearch < epsilonUpper) {
          assert(
            maxInformationGain(numStates, epsilonByBitSearch + 1e-15) >
              infoGainUpper
          )
        }
      })
    )
  )
})

const epsilonSearchTests = [
  {
    numStates: 5545,
    infoGainUpper: 6.5,
    epsilonUpper: 14,
    expected: 9.028709123768687,
  },
  {
    numStates: 2106,
    infoGainUpper: 6.5,
    epsilonUpper: 14,
    expected: 8.366900276574821,
  },
  {
    numStates: 16036,
    infoGainUpper: 6.5,
    epsilonUpper: 14,
    expected: 9.829279343808693,
  },
  {
    numStates: 84121,
    infoGainUpper: 11.5,
    epsilonUpper: 14,
    expected: 12.45087042924698,
  },
  {
    numStates: 24895,
    infoGainUpper: 11.5,
    epsilonUpper: 14,
    expected: 11.723490703852157,
  },
  {
    numStates: 3648,
    infoGainUpper: 11.5,
    epsilonUpper: 14,
    expected: 12.233993328032184,
  },
]

void test('epsilonSearch', async (t) => {
  await Promise.all(
    epsilonSearchTests.map((tc) =>
      t.test(`${tc.numStates}, ${tc.infoGainUpper}, ${tc.epsilonUpper}`, () => {
        assert.deepStrictEqual(
          tc.expected,
          epsilonToBoundInfoGainAndDp(
            tc.numStates,
            tc.infoGainUpper,
            tc.epsilonUpper
          )
        )
      })
    )
  )
})

const binaryEntropyTests = [
  { x: 0, expected: 0 },
  { x: 0.5, expected: 1 },
  { x: 1, expected: 0 },
  { x: 0.01, expected: 0.08079313589591118 },
  { x: 0.99, expected: 0.08079313589591124 },
]

void test('binaryEntropy', async (t) => {
  await Promise.all(
    binaryEntropyTests.map((tc) =>
      t.test(`${tc.x}`, () => {
        assert.deepStrictEqual(binaryEntropy(tc.x), tc.expected)
      })
    )
  )
})

function defaultConfig(sourceType: SourceType): Config {
  const defaultMaxReports =
    constants.defaultEventLevelAttributionsPerSource[sourceType]
  return new Config(
    /*maxEventLevelReports=*/ defaultMaxReports,
    /*attributionScopes=*/ null,
    new Array(Number(constants.defaultTriggerDataCardinality[sourceType])).fill(
      new PerTriggerDataConfig(
        /*numWindows=*/
        constants.defaultEarlyEventLevelReportWindows[sourceType].length + 1,
        /*numSummaryBuckets=*/ defaultMaxReports
      )
    )
  )
}

function scopeConfig(
  sourceType: SourceType,
  attributionScopeLimit: number,
  maxEventStates: number
): Config {
  const defaultMaxReports =
    constants.defaultEventLevelAttributionsPerSource[sourceType]
  return new Config(
    /*maxEventLevelReports=*/ defaultMaxReports,
    {
      limit: attributionScopeLimit,
      values: new Set<string>(),
      maxEventStates: maxEventStates,
    },
    new Array(Number(constants.defaultTriggerDataCardinality[sourceType])).fill(
      new PerTriggerDataConfig(
        /*numWindows=*/
        constants.defaultEarlyEventLevelReportWindows[sourceType].length + 1,
        /*numSummaryBuckets=*/ defaultMaxReports
      )
    )
  )
}

void test('computeConfigData', async (t) => {
  await t.test('navigation', () => {
    assert.deepStrictEqual(
      defaultConfig(SourceType.navigation).computeConfigData(
        14,
        vsv.Chromium.maxEventLevelChannelCapacityPerSource[
          SourceType.navigation
        ]
      ),
      {
        numStates: 2925,
        infoGain: 11.461727965384876,
        flipProb: 0.0024263221679834087,
      }
    )
  })

  await t.test('event', () => {
    assert.deepStrictEqual(
      defaultConfig(SourceType.event).computeConfigData(
        14,
        vsv.Chromium.maxEventLevelChannelCapacityPerSource[SourceType.event]
      ),
      {
        numStates: 3,
        infoGain: 1.584926511508231,
        flipProb: 0.000002494582008677539,
      }
    )
  })

  await t.test('attribution-scope-navigation', () => {
    assert.deepStrictEqual(
      scopeConfig(SourceType.navigation, 3, 4).computeConfigData(
        14,
        vsv.Chromium.maxEventLevelChannelCapacityPerSource[
          SourceType.navigation
        ]
      ),
      {
        attributionScopesInfoGain: 11.518161355756956,
        numStates: 2925,
        infoGain: 11.461727965384876,
        flipProb: 0.0024263221679834087,
      }
    )
  })

  await t.test('attribution-scope-event', () => {
    assert.deepStrictEqual(
      scopeConfig(SourceType.event, 3, 4).computeConfigData(
        14,
        vsv.Chromium.maxEventLevelChannelCapacityPerSource[SourceType.event]
      ),
      {
        attributionScopesInfoGain: 3.4594316186372973,
        numStates: 3,
        infoGain: 1.584926511508231,
        flipProb: 0.000002494582008677539,
      }
    )
  })
})
