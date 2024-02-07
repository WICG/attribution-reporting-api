import * as testutil from './util.test'
import { validateInfo } from './validate-info'

const tests = [
  {
    input: 'preferred-platform=os',
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
]

tests.forEach((tc) =>
  testutil.run(tc, /*name=*/ tc.input, () => validateInfo(tc.input))
)
