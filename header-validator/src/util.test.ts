import { strict as assert } from 'assert'
import * as context from './context'

export type TestCase = {
  expectedWarnings?: context.Issue[]
  expectedErrors?: context.Issue[]
}

export function run(
  tc: TestCase,
  name: string,
  f: () => context.ValidationResult
): void {
  const result = f()
  assert.deepEqual(
    result,
    {
      errors: tc.expectedErrors ?? [],
      warnings: tc.expectedWarnings ?? [],
    },
    name
  )
}
