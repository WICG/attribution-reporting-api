import * as testutil from './util.test'
import { validateEligible } from './validate-eligible'

const tests = [
  // Valid
  {input: ''},
  {input: 'event-source'},
  {input: 'trigger'},
  {input: 'event-source, trigger'},

  // Warnings
  {
    input: 'navigation-source',
    expectedWarnings: [{
      path: ['navigation-source'],
      msg: 'may only be specified in browser-initiated requests',
    }]
  },
  {
    input: 'x',
    expectedWarnings: [{
      path: ['x'],
      msg: 'unknown dictionary key',
    }],
  },
  {
    input: 'event-source=2',
    expectedWarnings: [{
      path: ['event-source'],
      msg: 'ignoring dictionary value',
    }],
  },
  {
    input: 'event-source;x=2',
    expectedWarnings: [{
      path: ['event-source'],
      msg: 'ignoring parameters',
    }],
  },

  // Invalid header syntax
  {
    input: '!',
    expectedErrors: [{msg: 'Error: Parse error: A key must begin with an asterisk or letter (a-z) at offset 0'}],
  },
]

tests.forEach(tc => testutil.run(tc, /*name=*/tc.input, () => validateEligible(tc.input)))
