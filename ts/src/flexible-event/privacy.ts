import memoize from 'memoizee'
import { AttributionScopes } from '../header-validator/source'

export type ExcessiveInfoGainData = {
  newEps: number
  newFlipProb: number
}

export type ConfigData = {
  numStates: number
  infoGain: number
  flipProb: number
  excessive?: ExcessiveInfoGainData
  attributionScopesInfoGain?: number
}

export class PerTriggerDataConfig {
  constructor(
    readonly numWindows: number,
    readonly numSummaryBuckets: number
  ) {
    if (this.numWindows <= 0) {
      throw new Error('numWindows must be > 0')
    }
    if (this.numSummaryBuckets < 0) {
      throw new Error('numSummaryBuckets must be >= 0')
    }
  }
}

export class Config {
  constructor(
    readonly maxEventLevelReports: number,
    readonly attributionScopes: AttributionScopes | null,
    readonly perTriggerDataConfigs: ReadonlyArray<PerTriggerDataConfig>
  ) {
    if (
      this.maxEventLevelReports < 0 ||
      !Number.isInteger(this.maxEventLevelReports)
    ) {
      throw new Error('maxEventLevelReports must be an integer >= 0')
    }
  }

  private numFlexibleStates(): number {
    if (
      this.maxEventLevelReports === 0 ||
      this.perTriggerDataConfigs.length === 0
    ) {
      return 1
    }

    // Let B be the trigger data cardinality.
    // For every trigger data i, there are w_i windows and c_i maximum reports / summary buckets.
    // The following helper function memoizes the recurrence relation:
    // 1. A[C, w_1, ..., w_B, c_1, ... , c_B] = 1 if B = 0
    // 2. A[C, w_1, ..., w_B, c_1, ... , c_B] = A[C, w_1, ..., w_{B-1}, c_1, ... , c_{B-1}] if w_B = 0
    // 3. A[C, w_1, ..., w_B, c_1, ... , c_B] = sum(A[C - j, w_1, ..., w_B - 1, c_1, ... , c_B - j], j from 0 to min(c_B, C)) otherwise
    const helper = memoize(
      (totalCap: number, index: number, w: number, c: number): number => {
        if (index === 0 && w === 0) {
          return 1
        }

        if (w === 0) {
          const triggerConfig = this.perTriggerDataConfigs.at(index - 1)!
          return helper(
            totalCap,
            index - 1,
            triggerConfig.numWindows,
            triggerConfig.numSummaryBuckets
          )
        }

        let sum = 0
        const end = Math.min(c, totalCap)
        for (let i = 0; i <= end; i++) {
          sum += helper(totalCap - i, index, w - 1, c - i)
        }
        return sum
      }
    )

    const lastConfig = this.perTriggerDataConfigs.at(-1)!
    const dataCardinality = this.perTriggerDataConfigs.length
    return helper(
      this.maxEventLevelReports,
      dataCardinality - 1,
      lastConfig.numWindows,
      lastConfig.numSummaryBuckets
    )
  }

  computeConfigData(epsilon: number, infoGainMax: number): ConfigData {
    const numStates = this.numFlexibleStates()
    const infoGain = maxInformationGain(numStates, epsilon)
    const flipProb = flipProbabilityDp(numStates, epsilon)

    const data: ConfigData = {
      numStates,
      infoGain,
      flipProb,
    }

    if (this.attributionScopes !== null) {
      data.attributionScopesInfoGain = attributionScopesInformationGain(
        numStates,
        this.attributionScopes.limit,
        this.attributionScopes.maxEventStates
      )
    }

    if (infoGain > infoGainMax) {
      const newEps = epsilonToBoundInfoGainAndDp(
        numStates,
        infoGainMax,
        epsilon
      )
      const newFlipProb = flipProbabilityDp(numStates, newEps)
      data.excessive = { newEps, newFlipProb }
    }

    return data
  }
}

// Evaluates the binary entropy function.
export function binaryEntropy(x: number): number {
  if (x === 0 || x === 1) {
    return 0
  }
  return -x * Math.log2(x) - (1 - x) * Math.log2(1 - x)
}

// Returns the flip probability to satisfy epsilon differential privacy.
// Uses the k-RR privacy mechanism.
export function flipProbabilityDp(numStates: number, epsilon: number): number {
  return numStates / (numStates + Math.exp(epsilon) - 1)
}

/**
 * Computes the capacity of the q-ary symmetric channel.
 *
 * @param log2q - the logarithm to base 2 of the alphabet size.
 * @param flipProbability - the channel keeps the input the same with probability
 *   1 - flipProbability, and flips the input to one of the other q - 1
 *   symbols (uniformly) with the remaining probability of flipProbability.
 *
 * @returns - The capacity of the q-ary symmetric channel for given flipProbability.
 *   In general, the capacity is defined as the maximum, over all input
 *   distributions, of the mutual information between the input and output of
 *   the channel. In the special case of the q-ary symmetric channel, a
 *   closed-form expression is known, which we use here.
 */
function capacityQarySymmetricChannel(
  log2q: number,
  flipProbability: number
): number {
  return (
    log2q -
    binaryEntropy(flipProbability) -
    flipProbability * Math.log2(Math.pow(2, log2q) - 1)
  )
}

function attributionScopesInformationGain(
  numStates: number,
  attributionScopeLimit: number,
  maxEventStates: number
): number {
  return Math.log2(numStates + maxEventStates * (attributionScopeLimit - 1))
}

export function maxInformationGain(numStates: number, epsilon: number): number {
  const flipProb = flipProbabilityDp(numStates, epsilon)
  if (numStates === 1 || flipProb === 1) {
    return 0
  }
  return capacityQarySymmetricChannel(
    Math.log2(numStates),
    (flipProb * (numStates - 1)) / numStates
  )
}

// Returns the effective epsilon needed to satisfy an information gain bound
// given a number of output states in the q-ary symmetric channel.
//
// The exponent section of the double is used as a power with base 2, which is
// multiplied by the significand, which is at least 1 and less than 2. In our
// case, the sign bit remains unset since we use a positive epsilon. The double
// is 2^exponent * significand. Since the significand is at least 1, changing it
// can only lower 2^exponent to at least its own value. And since the
// significand is less than 2, changing it can only raise 2^exponent to a value
// less than 2^(exponent + 1). We can therefore first find the highest
// 2^exponent less than or equal to max-settable-event-level-epsilon that
// produces information gain within limit, and then search for a significand
// that raises the overall value as much as possible.
//
// In an additive binary representation, the value represented by one bit is
// higher than all the values added by lower bits together. This inequality
// holds when multiplying by the constant, 2^exponent. This means that if we
// search the significand from high bits to low, each choice to set a bit either
// is already too high, or provides the opportunity to get closer to a higher
// target using some combination of the lower bits.
export function epsilonToBoundInfoGainAndDp(
  numStates: number,
  infoGainUpperBound: number,
  epsilonUpperBound: number
): number {
  const buffer = new ArrayBuffer(8)
  const dataView = new DataView(buffer)

  for (let bit = 1n << 62n; bit > 0n; bit >>= 1n) {
    const withoutBit = dataView.getBigUint64(0)
    dataView.setBigUint64(0, withoutBit | bit)

    const epsilon = dataView.getFloat64(0)
    if (epsilon > epsilonUpperBound) {
      dataView.setBigUint64(0, withoutBit)
      continue
    }

    const infoGain = maxInformationGain(numStates, epsilon)

    if (infoGain > infoGainUpperBound) {
      dataView.setBigUint64(0, withoutBit)
    } else if (epsilon === epsilonUpperBound) {
      return epsilon
    }
  }

  return dataView.getFloat64(0)
}
