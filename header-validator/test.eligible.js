import assert from 'node:assert/strict'
import { validateEligible } from './validate-eligible.js'

const tests = [
  // Valid
  {input: ''},
  {input: 'event-source'},
  {input: 'trigger'},
  {input: 'event-source, trigger'},

  // Warnings
  {
    input: 'navigation-source',
    warnings: [{
      path: ['navigation-source'],
      msg: 'may only be specified in browser-initiated requests',
    }]
  },
  {
    input: 'x',
    warnings: [{
      path: ['x'],
      msg: 'unknown dictionary key',
    }],
  },
  {
    input: 'event-source=2',
    warnings: [{
      path: ['event-source'],
      msg: 'ignoring dictionary value',
    }],
  },
  {
    input: 'event-source;x=2',
    warnings: [{
      path: ['event-source'],
      msg: 'ignoring parameters',
    }],
  },

  // Invalid header syntax
  {
    input: '!',
    errors: [{msg: 'Error: Parse error: A key must begin with an asterisk or letter (a-z) at offset 0'}],
  },
]

tests.forEach(test => {
  const { errors, warnings } = validateEligible(test.input);

  assert.deepEqual(errors, test.errors || [], test.input);
  assert.deepEqual(warnings, test.warnings || [], test.input);
});
