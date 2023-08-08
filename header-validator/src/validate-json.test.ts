import { strict as assert } from 'assert'
import { Issue, ValidationResult } from './issue'
import { Json, validateJSON, validateSource, validateTrigger } from './validate-json'
import { testCases as sourceTestCases } from './source.data.test'
import { testCases as triggerTestCases } from './trigger.data.test'

type TestCase = {
  name: string,
  json: string,
  expectedWarnings?: Array<Issue>,
  expectedErrors?: Array<Issue>,
}

function runTest(testCase: TestCase, validate: (value: Json) => ValidationResult) {
  const { errors, warnings } = validateJSON(testCase.json, validate)

  assert.deepEqual(errors, testCase.expectedErrors || [], testCase.name)
  assert.deepEqual(warnings, testCase.expectedWarnings || [], testCase.name)
}

sourceTestCases.forEach(testCase => runTest(testCase, validateSource))
triggerTestCases.forEach(testCase => runTest(testCase, validateTrigger))
