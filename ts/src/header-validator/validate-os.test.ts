import * as testutil from './util.test'
import { validateOsRegistration } from './validate-os'

type TestCase = testutil.TestCase & {
  input: string
}

const tests: TestCase[] = [
  // Valid
  { input: '"https://a.test/"' },
  { input: '"http://localhost/"' },
  { input: '"http://127.0.0.1/"' },
  { input: '"https://a.test/", "https://b.test/"' },
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
  },

  // Invalid header syntax
  {
    input: '!',
    expectedErrors: [
      { msg: 'Error: Parse error: Unexpected input at offset 0' },
    ],
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
    input: '"a.test"',
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
  },
]

tests.forEach((tc) =>
  testutil.run(tc, /*name=*/ tc.input, () => validateOsRegistration(tc.input))
)
