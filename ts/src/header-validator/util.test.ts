import { strict as assert } from 'assert'
import test from 'node:test'
import * as context from './context'

export type TestCase = {
  expectedWarnings?: context.Issue[]
  expectedErrors?: context.Issue[]
  expectedNotes?: context.Issue[]
}

export function run(
  tc: TestCase,
  name: string,
  f: () => context.ValidationResult
): void {
  void test(name, () => {
    const result = f()
    assert.deepEqual(result, {
      errors: tc.expectedErrors ?? [],
      warnings: tc.expectedWarnings ?? [],
      notes: tc.expectedNotes ?? [],
    })
  })
}
