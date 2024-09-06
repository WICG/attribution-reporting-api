import * as testutil from './util.test'
import { Maybe } from './maybe'
import * as os from './validate-os'

const tests: testutil.TestCase<os.OsItem[]>[] = [
  // Valid
  { input: '"https://a.test/"' },
  { input: '"http://localhost/"' },
  { input: '"http://127.0.0.1/"' },
  {
    input: '"https://a.test/x"; debug-reporting=?1, "https://b.test/y"',
    expected: Maybe.some([
      {
        url: new URL('https://a.test/x'),
        debugReporting: true,
      },
      {
        url: new URL('https://b.test/y'),
        debugReporting: false,
      },
    ]),
  },
  { input: '"https://a.test/"; debug-reporting' },
  { input: '"https://a.test/"; debug-reporting=?0' },
  { input: '"http://a.test"' },

  // Warnings
  {
    input: '"https://a.test/"; x=1',
    expectedWarnings: [
      {
        path: [0, 'x'],
        msg: 'unknown parameter',
      },
    ],
    expected: Maybe.some([
      {
        url: new URL('https://a.test/'),
        debugReporting: false,
      },
    ]),
  },

  // Invalid header syntax
  {
    input: '!',
    expectedErrors: [
      { msg: 'Error: Parse error: Unexpected input at offset 0' },
    ],
    expected: Maybe.None,
  },

  // Not a string
  {
    input: '"https://a.test", x',
    expectedWarnings: [
      {
        path: [1],
        msg: 'ignored, must be a string',
      },
    ],
    expected: Maybe.some([
      {
        url: new URL('https://a.test/'),
        debugReporting: false,
      },
    ]),
  },
  {
    input: '("https://a.test/")',
    expectedWarnings: [
      {
        path: [0],
        msg: 'ignored, must be a string',
      },
    ],
  },

  // Invalid URL
  {
    input: '"a.test", "https://b.test/"',
    expectedWarnings: [
      {
        path: [0],
        msg: 'ignored, must contain a valid URL',
      },
    ],
    expected: Maybe.some([
      {
        url: new URL('https://b.test/'),
        debugReporting: false,
      },
    ]),
  },
  // Relative URL
  {
    input: '"/x"',
    expectedWarnings: [
      {
        path: [0],
        msg: 'ignored, must contain a valid URL',
      },
    ],
  },

  // debug-reporting not a boolean
  {
    input: '"https://b.test/", "https://a.test/"; debug-reporting=1',
    expectedWarnings: [
      {
        path: [1, 'debug-reporting'],
        msg: 'ignored, must be a boolean',
      },
    ],
    expected: Maybe.some([
      {
        url: new URL('https://b.test/'),
        debugReporting: false,
      },
      {
        url: new URL('https://a.test/'),
        debugReporting: false,
      },
    ]),
  },
]

tests.forEach((tc) => testutil.run(tc, os))
