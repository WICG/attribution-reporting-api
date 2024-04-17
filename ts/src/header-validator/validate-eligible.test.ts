import { strict as assert } from 'assert'
import * as testutil from './util.test'
import { Maybe } from './maybe'
import { Eligible, validateEligible } from './validate-eligible'

type TestCase = testutil.TestCase & {
  input: string
  expected?: Maybe<Eligible>
}

const tests: TestCase[] = [
  // Valid
  {
    input: '',
    expected: Maybe.some({
      eventSource: false,
      navigationSource: false,
      trigger: false,
    }),
  },
  {
    input: 'event-source',
    expected: Maybe.some({
      eventSource: true,
      navigationSource: false,
      trigger: false,
    }),
  },
  {
    input: 'navigation-source',
    expected: Maybe.some({
      eventSource: false,
      navigationSource: true,
      trigger: false,
    }),
  },
  {
    input: 'trigger',
    expected: Maybe.some({
      eventSource: false,
      navigationSource: false,
      trigger: true,
    }),
  },
  {
    input: 'event-source, trigger',
    expected: Maybe.some({
      eventSource: true,
      navigationSource: false,
      trigger: true,
    }),
  },

  {
    input: 'x',
    expectedWarnings: [
      {
        path: ['x'],
        msg: 'unknown dictionary key',
      },
    ],
  },
  {
    input: 'event-source=2',
    expectedWarnings: [
      {
        path: ['event-source'],
        msg: 'ignoring dictionary value',
      },
    ],
  },
  {
    input: 'event-source;x=2',
    expectedWarnings: [
      {
        path: ['event-source'],
        msg: 'ignoring parameters',
      },
    ],
  },

  // Invalid header syntax
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
    input: 'navigation-source, trigger',
    expectedErrors: [
      {
        path: [],
        msg: 'navigation-source is mutually exclusive with event-source and trigger',
      },
    ],
    expected: Maybe.None,
  },
  {
    input: 'navigation-source, event-source',
    expectedErrors: [
      {
        path: [],
        msg: 'navigation-source is mutually exclusive with event-source and trigger',
      },
    ],
    expected: Maybe.None,
  },
]

tests.forEach((tc) =>
  testutil.run(tc, /*name=*/ tc.input, () => {
    const [validationResult, value] = validateEligible(tc.input)
    if (tc.expected !== undefined) {
      assert.deepEqual(value, tc.expected)
    }
    return validationResult
  })
)
