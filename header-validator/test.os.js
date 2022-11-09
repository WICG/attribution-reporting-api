import assert from 'node:assert/strict'
import { validateRegisterOsSource, validateRegisterOsTrigger } from './validate-os.js'

const tests = [
  // Valid
  {input: '"https://a.test/"'},
  {input: '"http://localhost/"'},
  {input: '"http://127.0.0.1/"'},

  // Warnings
  {
    input: '"https://a.test/"; x=1',
    warnings: [{
      path: ['x'],
      msg: 'unknown parameter',
    }],
  },

  // Invalid header syntax
  {
    input: '!',
    errors: [{msg: 'Error: Parse error: Unexpected input at offset 0'}],
  },

  // Not a string
  {
    input: 'x',
    errors: [{
      path: [],
      msg: 'must be a string',
    }],
  },

  // Invalid URL
  {
    input: '"a.test"',
    errors: [{
      path: [],
      msg: 'must contain a valid URL',
    }],
  },

  // Untrustworthy URL
  {
    input: '"http://a.test"',
    errors: [{
      path: [],
      msg: 'must contain a potentially trustworthy URL',
    }],
  },
]

tests.forEach(test => {
  [
      validateRegisterOsSource,
      validateRegisterOsTrigger,
  ].forEach(validate => {
    const { errors, warnings } = validate(test.input);

    assert.deepEqual(errors, test.errors || [], test.input);
    assert.deepEqual(warnings, test.warnings || [], test.input);
  });
});
