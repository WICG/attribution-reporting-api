import * as testutil from './util.test'
import { validateInfo } from './validate-info'

const tests = [
  {
    input: 'preferred-platform=os',
  },
  {
    input: 'preferred-platform=web',
  },
  {
    input: 'report-header-errors',
  },
  {
    input: 'report-header-errors=?0',
  },
  {
    input: 'preferred-platform=os,report-header-errors=?0',
  },

  // Warning
  {
    input: 'unknown-key',
    expectedWarnings: [
      {
        path: ['unknown-key'],
        msg: 'unknown dictionary key',
      },
    ],
  },
  {
    input: 'preferred-platform=os;x=2',
    expectedWarnings: [
      {
        path: ['preferred-platform'],
        msg: 'ignoring parameters',
      },
    ],
  },
  {
    input: 'report-header-errors;x=1',
    expectedWarnings: [
      {
        path: ['report-header-errors'],
        msg: 'ignoring parameters',
      },
    ],
  },

  // Error
  {
    input: '!',
    expectedErrors: [
      {
        msg: 'Error: Parse error: A key must begin with an asterisk or letter (a-z) at offset 0',
      },
    ],
  },
  {
    input: 'preferred-platform="os"',
    expectedErrors: [
      {
        path: ['preferred-platform'],
        msg: 'must be a token',
      },
    ],
  },
  {
    input: 'preferred-platform=abc',
    expectedErrors: [
      {
        path: ['preferred-platform'],
        msg: 'must be one of the following (case-sensitive): os, web',
      },
    ],
  },
  {
    input: 'report-header-errors=abc',
    expectedErrors: [
      {
        path: ['report-header-errors'],
        msg: 'must be a boolean',
      },
    ],
  },
]

tests.forEach((tc) =>
  testutil.run(tc, /*name=*/ tc.input, () => validateInfo(tc.input))
)
