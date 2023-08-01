import assert from 'node:assert/strict'
import { validateJSON, validateSource, validateTrigger } from '../src/validate-json.js'
import { testCases as sourceTestCases } from './data.source.js'
import { testCases as triggerTestCases } from './data.trigger.js'

function runTest(testCase, validate) {
  const { errors, warnings } = validateJSON(testCase.json, validate)

  assert.deepEqual(errors, testCase.expectedErrors || [], testCase.name)
  assert.deepEqual(warnings, testCase.expectedWarnings || [], testCase.name)
}

sourceTestCases.forEach(testCase => runTest(testCase, validateSource))
triggerTestCases.forEach(testCase => runTest(testCase, validateTrigger))
