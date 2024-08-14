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
function epsilonToBoundInfoGainAndDp(
  numStates: number,
  infoGainUpperBound: number,
  epsilonUpperBound: number,
  tolerance: number = 0.00001
): number {
  // Just perform a simple binary search over values of epsilon.
  let epsLow = 0
  let epsHigh = epsilonUpperBound

  for (;;) {
    const epsilon = (epsHigh + epsLow) / 2
    const infoGain = maxInformationGain(numStates, epsilon)

    if (infoGain > infoGainUpperBound) {
      epsHigh = epsilon
      continue
    }

    // Allow slack by returning something slightly non-optimal (governed by the tolerance)
    // that still meets the privacy bar. If epsHigh == epsLow we're now governed by the epsilon
    // bound and can return.
    if (infoGain < infoGainUpperBound - tolerance && epsHigh !== epsLow) {
      epsLow = epsilon
      continue
    }

    return epsilon
  }
}
