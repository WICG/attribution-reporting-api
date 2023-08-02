const commandLineArgs = require('command-line-args')
const fs = require('fs')

import {Config, DefaultConfig, PerTriggerDataConfig, SourceType} from './privacy'

function commaSeparatedInts(str: string): number[] {
  return str.split(',').map(v => Number(v))
}

function parseSourceType(str: string): SourceType {
  if (!(str in DefaultConfig)) {
    throw 'unknown source type'
  }
  return str as SourceType
}

function getNumWindowsFromJson(defaultVal: number, windows: any): number {
  if (typeof windows === 'undefined') {
    return defaultVal
  }

  if (typeof windows !== 'object') {
    throw 'event_report_windows must be an object'
  }

  const endTimes = windows['end_times']
  if (!Array.isArray(endTimes)) {
    throw 'end_times must be an array'
  }

  return endTimes.length
}

function getConfig(json: any, sourceType: SourceType): Config {
  if (typeof json !== 'object') {
    throw 'root JSON must be an object'
  }

  const defaultMaxReports = DefaultConfig[sourceType].maxEventLevelReports
  const defaultWindows = defaultMaxReports

  let maxEventLevelReports = json['max_event_level_reports']
  if (typeof maxEventLevelReports === 'undefined') {
    maxEventLevelReports = defaultMaxReports
  } else if (typeof maxEventLevelReports !== 'number') {
    throw 'max_event_level_reports must be a number'
  }

  const topLevelNumWindows = getNumWindowsFromJson(defaultWindows, json['event_report_windows'])

  const triggerSpecs = json['trigger_specs']
  if (!Array.isArray(triggerSpecs)) {
    throw 'trigger_specs must be an array'
  }

  const perTriggerDataConfigs: PerTriggerDataConfig[] = []
  triggerSpecs.forEach((spec: any) => {
    if (typeof spec !== 'object') {
      throw 'trigger_specs item must be an object'
    }

    const triggerData = spec['trigger_data']
    if (!Array.isArray(triggerData)) {
      throw 'trigger_data must be an array'
    }

    const numDataTypes = triggerData.length

    const numWindows = getNumWindowsFromJson(topLevelNumWindows, spec['event_report_windows'])

    // Technically this can be larger, but we will always be constrained
    // by `max_event_level_reports`.
    let numBuckets = maxEventLevelReports
    const summaryBuckets = spec['summary_buckets']
    if (typeof summaryBuckets !== 'undefined') {
        if (!Array.isArray(summaryBuckets)) {
          throw 'summary_buckets must be an array'
        }
        numBuckets = summaryBuckets.length
    }

    for (let i = 0; i < numDataTypes; i++) {
      perTriggerDataConfigs.push(new PerTriggerDataConfig(numWindows, numBuckets))
    }
  });

  return new Config(maxEventLevelReports, perTriggerDataConfigs)
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
    defaultValue: SourceType.Navigation,
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

let config: Config
if ('json_file' in options) {
  const json = JSON.parse(fs.readFileSync(options.json_file, {encoding: 'utf8'}))
  config = getConfig(json, options.source_type)
} else {
  if (options.windows.length != options.buckets.length) {
    throw 'windows and buckets must have same length'
  }
  config = new Config(
    options.max_event_level_reports,
    options.windows.map((w: number, i: number) => new PerTriggerDataConfig(w, options.buckets[i])),
  )
}

const out = config.computeConfigData(options.epsilon, options.source_type)

console.log(`Number of possible different output states: ${out.numStates}`)
console.log(`Information gain: ${out.infoGain.toFixed(2)} bits`)
console.log(`Flip percent: ${(100 * out.flipProb).toFixed(5)}%`)

if (out.excessive) {
  const e = out.excessive
  console.log(
      `WARNING: info gain > ${e.infoGainDefault.toFixed(2)} for ${options.source_type} sources. Would require a ${(100 *
        e.newFlipProb).toFixed(5)}% flip chance (effective epsilon = ${e.newEps.toFixed(3)}) to resolve.`)
}
