import { strict as assert } from 'assert'
import * as context from './context'
import { Maybe } from './maybe'
import * as testutil from './util.test'
import * as vsv from '../vendor-specific-values'

export type TestCase<T> = testutil.TestCase & {
  name: string
  json: string
  vsv?: Readonly<Partial<vsv.VendorSpecificValues>>
  parseFullFlex?: boolean
  expected?: Maybe<T>
}

export function run<T>(
  tc: TestCase<T>,
  f: () => [context.ValidationResult, Maybe<T>]
): void {
  testutil.run(tc, tc.name, () => {
    const [validationResult, value] = f()
    if (tc.expected !== undefined) {
      assert.deepEqual(value, tc.expected)
    }
    return validationResult
  })
}
