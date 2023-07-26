const assert = require('assert')

const Ajv2020 = require('ajv/dist/2020')

const schema_source = require('./source.schema.json')
const schema_trigger = require('./trigger.schema.json')

const ajv = new Ajv2020()

const validate_source = ajv.compile(schema_source)
const validate_trigger = ajv.compile(schema_trigger)

function validate(validate, testCase) {
  validate(testCase.object)
  assert.deepEqual(validate.errors || [], testCase.errors || [], testCase.name)
}

// TODO: add coverage of all requirements
const sourceCases = [
  {
    name: 'minimal',
    object: { destination: '' },
  },
  {
    name: 'no-destination',
    object: {},
    errors: [
      {
        instancePath: '',
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'destination' },
        message: `must have required property 'destination'`,
      }
    ],
  },
  {
    name: 'integer-expiry',
    object: {
      destination: '',
      expiry: 3,
    },
  },
  {
    name: 'string-expiry',
    object: {
      destination: '',
      expiry: '3',
    },
  },
  {
    name: 'invalid-expiry',
    object: {
      destination: '',
      expiry: -3,
    },
    errors: [
      {
        instancePath: '/expiry',
        schemaPath: '#/$defs/non_negative_integer/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0'
      },
      {
        instancePath: '/expiry',
        schemaPath: '#/$defs/unsigned_duration_in_seconds/type',
        keyword: 'type',
        params: { type: 'string' },
        message: 'must be string'
      },
      {
        instancePath: '/expiry',
        schemaPath: '#/oneOf',
        keyword: 'oneOf',
        params: { passingSchemas: null },
        message: 'must match exactly one schema in oneOf'
      }
    ],
  },
]

// TODO: add coverage of all requirements
const triggerCases = [
  {
    name: 'minimal',
    object: {},
  },
  {
    name: 'debug-key-wrong-type',
    object: { debug_key: 1 },
    errors: [
      {
        instancePath: '/debug_key',
        schemaPath: '#/$defs/unsigned_base10_integer/type',
        keyword: 'type',
        params: { type: 'string' },
        message: 'must be string',
      }
    ],
  },
]

sourceCases.forEach(validate.bind(this, validate_source))
triggerCases.forEach(validate.bind(this, validate_trigger))
