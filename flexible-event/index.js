const commandLineArgs = require('command-line-args')
const fs = require('fs')
const memoize = require('memoizee')

const DEFAULT_CONFIG = {
  'navigation': {
    maxEventLevelReports: 3,
    perTriggerDataConfigs: [
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
    ],
  },
  'event': {
    maxEventLevelReports: 1,
    perTriggerDataConfigs: [
      [1, 1],
      [1, 1],
    ],
  },
}

/**
 * Returns the total number of output states for a given configuration of the flexible event-level API
 *
 * @param maxEventLevelReports - The value of `max_event_level_reports` in the source registration.
 * @param per_type_configs - A list of tuples of (num_windows, num_summary_buckets), per `trigger_data`
 */
function numFlexibleStates({
  maxEventLevelReports,
  perTriggerDataConfigs,
}) {
  // Let B be the trigger data cardinality.
  // For every trigger data i, there are w_i windows and c_i maximum reports / summary buckets.
  // The following helper function memoizes the recurrence relation:
  // 1. A[C, w_1, ..., w_B, c_1, ... , c_B] = 1 if B = 0
  // 2. A[C, w_1, ..., w_B, c_1, ... , c_B] = A[C, w_1, ..., w_{B-1}, c_1, ... , c_{B-1}] if w_B = 0
  // 3. A[C, w_1, ..., w_B, c_1, ... , c_B] = sum(A[C - j, w_1, ..., w_B - 1, c_1, ... , c_B - j], j from 0 to min(c_B, C)) otherwise
  const helper = memoize(function(totalCap, index, w, c) {
    if (index == 0 && w == 0) {
      return 1
    }

    if (w == 0) {
      const triggerConfig = perTriggerDataConfigs[index - 1]
      return helper(totalCap, index - 1, triggerConfig[0], triggerConfig[1])
    }

    let sum = 0
    const end = c < totalCap ? c : totalCap
    for (let i = 0; i <= end; i++) {
      sum += helper(totalCap - i, index, w - 1, c - i)
    }
    return sum
  })

  const lastConfig = perTriggerDataConfigs[perTriggerDataConfigs.length - 1]
  const dataCardinality = perTriggerDataConfigs.length
  return helper(maxEventLevelReports, dataCardinality - 1, lastConfig[0], lastConfig[1])
}

// Evaluates the binary entropy function.
function h(x) {
  if (x == 0 || x == 1) {
    return 0
  }
  return -x * Math.log2(x) - (1 - x) * Math.log2(1 - x)
}

// Returns the flip probability to satisfy epsilon differential privacy.
// Uses the k-RR privacy mechanism.
function flipProbabilityDp(numStates, epsilon) {
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
function capacityQarySymmetricChannel(log2q, flipProbability) {
  return log2q - h(flipProbability) - flipProbability * Math.log2(Math.pow(2, log2q) - 1)
}


// Returns the maximum information for a source using the flexible event API.
function maxInformationGain(numStates, epsilon) {
  const flipProb = flipProbabilityDp(numStates, epsilon)
  return capacityQarySymmetricChannel(Math.log2(numStates),
      flipProb * (numStates - 1) / numStates)
}

// Returns the effective epsilon and flip probability needed to satisfy an information gain bound
// given a number of output states in the q-ary symmetric channel.
function epsilonToBoundInfoGainAndDp(
    numStates,
    infoGainUpperBound,
    epsilonUpperBound,
    tolerance = 0.00001) {
  // Just perform a simple binary search over values of epsilon.
  let epsLow = 0
  let epsHigh = epsilonUpperBound

  while (true) {
    const epsilon = (epsHigh + epsLow) / 2
    const infoGain = maxInformationGain(numStates, epsilon)

    if (infoGain > infoGainUpperBound) {
      epsHigh = epsilon
      continue
    }

    // Allow slack by returning something slightly non-optimal (governed by the tolerance)
    // that still meets the privacy bar. If epsHigh == epsLow we're now governed by the epsilon
    // bound and can return.
    if (infoGain < infoGainUpperBound - tolerance && epsHigh != epsLow) {
      epsLow = epsilon
      continue
    }

    return [epsilon, flipProbabilityDp(numStates, epsilon)]
  }
}

function printConfigData(config, epsilon, sourceType) {
  const numStates = numFlexibleStates(config)
  const infoGain = maxInformationGain(numStates, epsilon)
  const flipProb = flipProbabilityDp(numStates, epsilon)

  console.log(`Number of possible different output states: ${numStates}`)
  console.log(`Information gain: ${infoGain} bits`)
  console.log(`Flip percent: ${100 * flipProb}%`)

  const infoGainDefault = maxInformationGain(
        numFlexibleStates(DEFAULT_CONFIG[sourceType]), epsilon)

  if (infoGain > infoGainDefault) {
      const [newEps, flipProb] = epsilonToBoundInfoGainAndDp(numStates, infoGainDefault, epsilon)
      console.log(
          `WARNING: info gain of ${infoGain} > ${infoGainDefault} for ${sourceType} sources. Would require a ${100 * flipProb}% flip chance (effective epsilon = ${newEps}) to resolve.`)
  }
}

function parseSourceType(str) {
  if (!str in DEFAULT_CONFIG) {
    throw 'unknown source type'
  }
  return str
}

function commaSeparatedInts(str) {
  return str.split(',').map(v => Number(v))
}

function getConfig(json, sourceType) {
  const defaultMaxReports = sourceType == 'navigation' ? 3 : 1
  const defaultWindows = sourceType == 'navigation' ? 3 : 1

  const maxEventLevelReports =
    ('max_event_level_reports' in json) ?  json.max_event_level_reports : defaultMaxReports

  const topLevelNumWindows =
    ('event_report_windows' in json) ?
    json.event_report_windows.end_times.length : defaultWindows

  const perTriggerDataConfigs = []
  json.trigger_specs.forEach(spec => {
    const numDataTypes = spec.trigger_data.length
    const numWindows =
      ('event_report_windows' in spec) ?
      spec.event_report_windows.end_times.length : topLevelNumWindows

      // Technically this can be larger, but we will always be constrained
      // by `max_event_level_reports`.
      const numBuckets =
        ('summary_buckets' in spec) ?
        spec.summary_buckets.length : maxEventLevelReports

      for (let i = 0; i < numDataTypes; i++) {
        perTriggerDataConfigs.push([numWindows, numBuckets])
      }
  });

  return {maxEventLevelReports, perTriggerDataConfigs}
}

const optionDefs = [
  {
    name: 'max_event_level_reports',
    alias: 'm',
    type: Number,
    defaultValue: 20,
  },
  {
    name: 'epsilon',
    alias: 'e',
    type: Number,
    defaultValue: 14,
  },
  {
    name: 'source_type',
    alias: 't',
    type: parseSourceType,
    defaultValue: 'navigation',
  },
  {
    name: 'windows',
    alias: 'w',
    type: commaSeparatedInts,
  },
  {
    name: 'buckets',
    alias: 'b',
    type: commaSeparatedInts,
  },
  {
    name: 'json_file',
    alias: 'f',
    type: String,
  },
]

const options = commandLineArgs(optionDefs)

let config
if ('json_file' in options) {
  const json = JSON.parse(fs.readFileSync(options.json_file, {encoding: 'utf8'}))
  config = getConfig(json, options.source_type)
} else {
  if (options.windows.length != options.buckets.length) {
    throw 'windows and buckets must have same length'
  }
  config = {
    maxEventLevelReports: options.max_event_level_reports,
    perTriggerDataConfigs: options.windows.map((w, i) => [w, options.buckets[i]]),
  }
}

printConfigData(config, options.epsilon, options.source_type)
