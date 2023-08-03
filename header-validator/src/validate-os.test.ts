import { strict as assert } from 'assert'
import { validateOsRegistration } from './validate-os'

const tests = [
  // Valid
  {input: '"https://a.test/"'},
  {input: '"http://localhost/"'},
  {input: '"http://127.0.0.1/"'},
  {input: '"https://a.test/", "https://b.test/"'},
  {input: '"https://a.test/"; debug-reporting'},
  {input: '"https://a.test/"; debug-reporting=?0'},

  // Warnings
  {
    input: '"https://a.test/"; x=1',
    warnings: [{
      path: [0, 'x'],
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
    input: '"https://a.test", x',
    errors: [{
      path: [1],
      msg: 'must be a string',
    }],
  },
  {
    input: '("https://a.test/")',
    errors: [{
      path: [0],
      msg: 'must be a string',
    }],
  },

  // Invalid URL
  {
    input: '"a.test"',
    errors: [{
      path: [0],
      msg: 'must contain a valid URL',
    }],
  },

  // Untrustworthy URL
  {
    input: '"http://a.test"',
    errors: [{
      path: [0],
      msg: 'must contain a potentially trustworthy URL',
    }],
  },

  // debug-reporting not a boolean
  {
    input: '"https://b.test/", "https://a.test/"; debug-reporting=1',
    errors: [{
      path: [1, 'debug-reporting'],
      msg: 'must be a boolean',
    }],
  },
]

tests.forEach(test => {
  [
      validateOsRegistration,
  ].forEach(validate => {
    const { errors, warnings } = validate(test.input)

    assert.deepStrictEqual(errors, test.errors || [], test.input)
    assert.deepStrictEqual(warnings, test.warnings || [], test.input)
  })
})
