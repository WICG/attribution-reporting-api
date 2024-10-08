import * as testutil from './util.test'
import { Maybe } from './maybe'
import * as info from './validate-info'

const tests: testutil.TestCase<info.Info>[] = [
  {
    input: 'preferred-platform=os',
  },
  {
    input: 'preferred-platform=web',
    expected: Maybe.some({
      preferredPlatform: info.PreferredPlatform.web,
      reportHeaderErrors: false,
    }),
  },
  {
    input: 'report-header-errors',
    expected: Maybe.some({
      preferredPlatform: null,
      reportHeaderErrors: true,
    }),
  },
  {
    input: 'report-header-errors=?0',
  },
  {
    input: 'preferred-platform=os,report-header-errors=?0',
    expected: Maybe.some({
      preferredPlatform: info.PreferredPlatform.os,
      reportHeaderErrors: false,
    }),
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
    expected: Maybe.None,
  },
  {
    input: 'preferred-platform="os"',
    expectedErrors: [
      {
        path: ['preferred-platform'],
        msg: 'must be a token',
      },
    ],
    expected: Maybe.None,
  },
  {
    input: 'preferred-platform=abc',
    expectedErrors: [
      {
        path: ['preferred-platform'],
        msg: 'must be one of the following (case-sensitive): os, web',
      },
    ],
    expected: Maybe.None,
  },
  {
    input: 'report-header-errors=abc',
    expectedErrors: [
      {
        path: ['report-header-errors'],
        msg: 'must be a boolean',
      },
    ],
    expected: Maybe.None,
  },
]

tests.forEach((tc) => testutil.run(tc, info))
