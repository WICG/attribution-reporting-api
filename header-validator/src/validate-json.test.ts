import * as testutil from './util.test'
import { ValueCheck, VendorSpecificValues, validateJSON } from './validate-json'

export type TestCase = testutil.TestCase & {
  name: string
  json: string
  vsv?: Partial<VendorSpecificValues>
}

export function runAll(validate: ValueCheck, tcs: TestCase[]) {
  tcs.forEach((tc) =>
    testutil.run(tc, tc.name, () =>
      validateJSON(tc.json, validate, tc.vsv ?? {})
    )
  )
}
