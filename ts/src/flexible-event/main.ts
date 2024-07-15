import { parse } from 'ts-command-line-args'
import { readFileSync } from 'fs'

import { Issue } from '../header-validator/context'
import { Maybe } from '../header-validator/maybe'
import { validateSource } from '../header-validator/validate-json'
import { SourceType, parseSourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import { Config, PerTriggerDataConfig } from './privacy'

// Workaround for `parse` not handling top-level array types without `multiple`
// `OptionDef` configuration.
type Wrapped<T> = { value: T }

function commaSeparatedInts(str: string): Wrapped<number[]> {
  return { value: str.split(',').map((v) => Number(v)) }
}

interface Arguments {
  max_event_level_reports: number
  epsilon: number
  source_type: SourceType
  windows?: Wrapped<number[]>
  buckets?: Wrapped<number[]>
  json_file?: string
}

const options = parse<Arguments>({
  max_event_level_reports: {
    alias: 'm',
    type: Number,
    defaultValue: 20,
  },
  epsilon: {
    alias: 'e',
    type: Number,
    defaultValue: 14,
  },
  source_type: {
    alias: 't',
    type: parseSourceType,
    defaultValue: SourceType.navigation,
  },
  windows: {
    alias: 'w',
    type: commaSeparatedInts,
    optional: true,
  },
  buckets: {
    alias: 'b',
    type: commaSeparatedInts,
    optional: true,
  },
  json_file: {
    alias: 'f',
    type: String,
    optional: true,
  },
})

function logIssue(prefix: string, i: Issue): void {
  console.log(
    `${prefix}: ${i.path !== undefined ? i.path.join('/') : 'root'}: ${i.msg}`
  )
}

let config: Maybe<Config> = Maybe.None
if (options.json_file !== undefined) {
  const json = readFileSync(options.json_file, { encoding: 'utf8' })
  const [{ errors, warnings }, source] = validateSource(
    json,
    vsv.Chromium,
    options.source_type,
    /*parseFullFlex=*/ true
  )
  warnings.forEach((i) => logIssue('W', i))
  if (errors.length > 0) {
    errors.forEach((i) => logIssue('E', i))
    process.exit(1)
  }

  config = source.map(
    (source) =>
      new Config(
        source.maxEventLevelReports,
        source.triggerSpecs.flatMap((spec) =>
          new Array<PerTriggerDataConfig>(spec.triggerData.size).fill(
            new PerTriggerDataConfig(
              spec.eventReportWindows.endTimes.length,
              spec.summaryBuckets.length
            )
          )
        )
      )
  )
} else if (options.windows === undefined || options.buckets === undefined) {
  throw new Error('windows and buckets must be specified if json_file is not')
} else {
  if (options.windows.value.length !== options.buckets.value.length) {
    throw new Error('windows and buckets must have same length')
  }
  config = Maybe.some(
    new Config(
      options.max_event_level_reports,
      options.windows.value.map(
        (w: number, i: number) =>
          new PerTriggerDataConfig(w, options.buckets!.value[i]!)
      )
    )
  )
}

config.peek((config) => {
  const infoGainMax =
    vsv.Chromium.maxEventLevelChannelCapacityPerSource[options.source_type]

  const out = config.computeConfigData(options.epsilon, infoGainMax)

  console.log(`Number of possible different output states: ${out.numStates}`)
  console.log(`Information gain: ${out.infoGain.toFixed(2)} bits`)
  console.log(`Randomized trigger rate: ${out.flipProb.toFixed(7)}`)

  if (out.excessive) {
    const e = out.excessive
    console.log(
      `WARNING: info gain > ${infoGainMax.toFixed(2)} for ${
        options.source_type
      } sources. Would require a ${e.newFlipProb.toFixed(
        7
      )} randomized trigger rate (effective epsilon = ${e.newEps.toFixed(
        3
      )}) to resolve.`
    )
  }
})
