import { parse } from 'ts-command-line-args'
import { readFileSync } from 'fs'

import { validate } from './validator'
import * as source from './validate-source'
import * as trigger from './validate-trigger'
import { SourceType, parseSourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'

interface Arguments {
  input?: string
  file?: string

  fullFlex: boolean
  scopes: boolean
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
    scopes: {
      type: Boolean,
      description: 'If true, parse experimental Attribution Scopes fields.',
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

const out = validate<unknown>(
  options.input!,
  options.sourceType === undefined
    ? trigger.validator({
        vsv: vsv.Chromium,
        fullFlex: options.fullFlex,
        scopes: options.scopes,
      })
    : source.validator({
        vsv: vsv.Chromium,
        fullFlex: options.fullFlex,
        sourceType: options.sourceType,
        scopes: options.scopes,
      })
)

if (!options.silent) {
  console.log(JSON.stringify(out, /*replacer=*/ null, '  '))
}

if (
  out.errors.length > 0 ||
  (options.failOnWarnings && out.warnings.length > 0)
) {
  process.exit(1)
}
