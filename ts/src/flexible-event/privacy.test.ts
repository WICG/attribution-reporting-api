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

test('flipProbabilityDp', async (t) => {
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
]

test('maxInformationGain', async (t) => {
  await Promise.all(
    infoGainTests.map((tc, i) =>
      t.test(`${i}`, () => {
        const actual = maxInformationGain(tc.numStates, tc.epsilon)
        assert.deepStrictEqual(actual, tc.expected)
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

test('binaryEntropy', async (t) => {
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
    new Array(Number(constants.defaultTriggerDataCardinality[sourceType])).fill(
      new PerTriggerDataConfig(
        /*numWindows=*/
        constants.defaultEarlyEventLevelReportWindows[sourceType].length + 1,
        /*numSummaryBuckets=*/ defaultMaxReports
      )
    )
  )
}

test('computeConfigData', async (t) => {
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
})
