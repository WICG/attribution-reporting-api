const commandLineArgs = require('command-line-args')
import { readFileSync } from 'fs'

import { Issue } from '../header-validator/context'
import { Maybe } from '../header-validator/maybe'
import { validateSource } from '../header-validator/validate-json'
import { SourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import { Config, PerTriggerDataConfig } from './privacy'

function commaSeparatedInts(str: string): number[] {
  return str.split(',').map((v) => Number(v))
}

function parseSourceType(str: string): SourceType {
  if (!(str in SourceType)) {
    throw 'unknown source type'
  }
  return str as SourceType
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
    defaultValue: SourceType.navigation,
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

function logIssue(prefix: string, i: Issue): void {
  console.log(
    `${prefix}: ${i.path !== undefined ? i.path.join('/') : 'root'}: ${i.msg}`
  )
}

const options = commandLineArgs(optionDefs)

let config: Maybe<Config> = Maybe.None
if ('json_file' in options) {
  const json = readFileSync(options.json_file, { encoding: 'utf8' })
  const [{ errors, warnings }, source] = validateSource(
    json,
    vsv.Chromium,
    options.source_type,
    { parseFullFlex: true }
  )
  warnings.forEach((i) => logIssue('W', i))
  if (errors.length > 0) {
    errors.forEach((i) => logIssue('E', i))
    process.exit(1)
  }

  config = source.map(
    (source) =>
      new Config(
        source.maxEventLevelReports!,
        source.triggerSpecs.flatMap((spec) =>
          new Array(spec.triggerData.size).fill(
            new PerTriggerDataConfig(
              spec.eventReportWindows.endTimes.length,
              spec.summaryBuckets.length
            )
          )
        )
      )
  )
} else {
  if (options.windows.length !== options.buckets.length) {
    throw 'windows and buckets must have same length'
  }
  config = Maybe.some(
    new Config(
      options.max_event_level_reports,
      options.windows.map(
        (w: number, i: number) =>
          new PerTriggerDataConfig(w, options.buckets[i])
      )
    )
  )
}

config.peek((config) => {
  const infoGainMax =
    vsv.Chromium.maxEventLevelChannelCapacityPerSource[
      options.source_type as SourceType
    ]

  const out = config.computeConfigData(options.epsilon, infoGainMax)

  console.log(`Number of possible different output states: ${out.numStates}`)
  console.log(`Information gain: ${out.infoGain.toFixed(2)} bits`)
  console.log(`Flip percent: ${(100 * out.flipProb).toFixed(5)}%`)

  if (out.excessive) {
    const e = out.excessive
    console.log(
      `WARNING: info gain > ${infoGainMax.toFixed(2)} for ${
        options.source_type
      } sources. Would require a ${(100 * e.newFlipProb).toFixed(
        5
      )}% flip chance (effective epsilon = ${e.newEps.toFixed(3)}) to resolve.`
    )
  }
})
