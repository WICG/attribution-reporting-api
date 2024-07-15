import { parse } from 'ts-command-line-args'
import { readFileSync } from 'fs'

import { Maybe } from './maybe'
import { ValidationResult } from './context'
import { validateSource, validateTrigger } from './validate-json'
import { SourceType, parseSourceType } from '../source-type'
import { serializeSource, serializeTrigger } from './to-json'
import * as vsv from '../vendor-specific-values'

interface Arguments {
  input?: string
  file?: string

  fullFlex: boolean
  sourceType?: SourceType

  silent: boolean
  failOnWarnings: boolean

  help: boolean
}

const options = parse<Arguments>(
  {
    input: {
      type: String,
      optional: true,
      description: 'Input to parse.',
    },
    file: {
      type: String,
      defaultOption: true,
      optional: true,
      typeLabel: 'file',
      description: 'File containing input to parse. Use - to read from stdin.',
    },

    sourceType: {
      type: parseSourceType,
      optional: true,
      typeLabel: '(event|navigation)',
      description:
        'If present, parse input as a source. Otherwise, parse as a trigger.',
    },

    fullFlex: {
      type: Boolean,
      description: 'If true, parse experimental Full Flexible Event fields.',
    },

    silent: {
      type: Boolean,
      description: 'If true, suppress output.',
    },
    failOnWarnings: {
      type: Boolean,
      description:
        'If true, exit with 1 if there were parsing errors or warnings.',
    },

    help: {
      alias: 'h',
      type: Boolean,
      description: 'Prints this usage guide.',
    },
  },
  {
    helpArg: 'help',
    headerContentSections: [
      {
        header: 'Attribution Reporting Header Validator',
        content: [
          "Parses an Attribution-Reporting-Register-Source or Attribution-Reporting-Register-Trigger header using Chromium's vendor-specific values.",
          'Prints errors, warnings, notes, and the effective value (i.e. with defaults populated) to stdout in JSON format.',
          'Exits with 1 if there were parsing errors, 0 otherwise.',
        ].join('\n\n'),
      },
    ],
  }
)

if ((options.file === undefined) === (options.input === undefined)) {
  throw new TypeError('exactly one of --file or --input must be specified')
}

if (options.file !== undefined) {
  options.input = readFileSync(options.file === '-' ? 0 : options.file, {
    encoding: 'utf8',
  })
}

function mapResult<T, U>(
  [result, value]: [ValidationResult, Maybe<T>],
  f: (value: T) => U
): [ValidationResult, Maybe<U>] {
  return [result, value.map(f)]
}

const [result, value] =
  options.sourceType === undefined
    ? mapResult(
        validateTrigger(options.input!, vsv.Chromium, options.fullFlex),
        (value) => serializeTrigger(value, options.fullFlex)
      )
    : mapResult(
        validateSource(
          options.input!,
          vsv.Chromium,
          options.sourceType,
          options.fullFlex
        ),
        (value) => serializeSource(value, options.fullFlex)
      )

if (!options.silent) {
  const out: ValidationResult & { value?: object } = result
  value.peek((value) => (out.value = value))
  console.log(JSON.stringify(out, /*replacer=*/ null, '  '))
}

if (
  result.errors.length > 0 ||
  (options.failOnWarnings && result.warnings.length > 0)
) {
  process.exit(1)
}
