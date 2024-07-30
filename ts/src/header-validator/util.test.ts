import { strict as assert } from 'assert'
import test from 'node:test'
import * as context from './context'
import { Maybe } from './maybe'
import { Validator } from './validator'

export type TestCase<T> = {
  name?: string
  input: string
  expectedWarnings?: context.Issue[]
  expectedErrors?: context.Issue[]
  expectedNotes?: context.Issue[]
  expected?: Maybe<T>
}

export function run<T>(tc: TestCase<T>, validator: Validator<T>): void {
  void test(tc.name ?? tc.input, () => {
    const [result, value] = validator.validate(tc.input)
    assert.deepEqual(result, {
      errors: tc.expectedErrors ?? [],
      warnings: tc.expectedWarnings ?? [],
      notes: tc.expectedNotes ?? [],
    })

    if (tc.expected !== undefined) {
      assert.deepEqual(value, tc.expected)
    }

    if (value.value !== undefined) {
      const str = validator.serialize(value.value)
      const [, reparsed] = validator.validate(str)
      assert.deepEqual(reparsed, value, str)
    }
  })
}
