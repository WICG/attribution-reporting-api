import { flipProbabilityDp, maxInformationGain, binaryEntropy, DefaultConfig, SourceType } from './privacy'
import { strict as assert } from 'assert'

const flipProbabilityTests = [
    {
        numStates: 2,
        epsilon: Math.log(3),
        expected: .5
    },
    {
        numStates: 3,
        epsilon: Math.log(3),
        expected: .6
    },
    {
        numStates: 2925,
        epsilon: 14,
        expected: 0.0024263221679834087
    },
    {
        numStates: 3,
        epsilon: 14,
        expected: 0.000002494582008677539
    },
]

flipProbabilityTests.forEach(test => {
    const flipProb = flipProbabilityDp(test.numStates, test.epsilon);
    assert.deepStrictEqual(flipProb, test.expected);
})

const infoGainTests = [
    {
        numStates: 2,
        epsilon: Infinity,
        expected: 1
    },
    {
        numStates: 1024,
        epsilon: Infinity,
        expected: Math.log2(1024)
    },
    {
        numStates: 3,
        epsilon: Infinity,
        expected: Math.log2(3)
    },
    {
        numStates: 2,
        epsilon: Math.log(3),
        expected: 0.18872187554086717
    },
    {
        numStates: 2925,
        epsilon: 14,
        expected: 11.461727965384876
    },
    {
        numStates: 3,
        epsilon: 14,
        expected: 1.584926511508231
    },
]

infoGainTests.forEach(test => {
    const infoGain = maxInformationGain(test.numStates, test.epsilon)
    assert.deepStrictEqual(infoGain, test.expected)
})

const binaryEntropyTests = [
    { x: 0, expected: 0 },
    { x: .5, expected: 1 },
    { x: 1, expected: 0 },
    { x: .01, expected: 0.08079313589591118 },
    { x: .99, expected: 0.08079313589591124 },
]

binaryEntropyTests.forEach(test => {
    assert.deepStrictEqual(binaryEntropy(test.x), test.expected)
})

assert.deepStrictEqual(DefaultConfig[SourceType.Navigation].computeConfigData(14, SourceType.Navigation), {
    numStates: 2925,
    infoGain: 11.461727965384876,
    flipProb: 0.0024263221679834087,
    excessive: undefined
})

assert.deepStrictEqual(DefaultConfig[SourceType.Event].computeConfigData(14, SourceType.Event), {
    numStates: 3,
    infoGain: 1.584926511508231,
    flipProb: 0.000002494582008677539,
    excessive: undefined
})