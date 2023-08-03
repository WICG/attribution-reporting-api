import { flipProbabilityDp } from './privacy'
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
  