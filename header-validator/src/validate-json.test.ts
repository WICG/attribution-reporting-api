import * as testutil from './util.test'
import { ValueCheck, validateJSON } from './validate-json'

export type TestCase = testutil.TestCase & {
  name: string
  json: string
}

export function runAll(validate: ValueCheck, tcs: TestCase[]) {
  tcs.forEach((tc) =>
    testutil.run(tc, tc.name, () => validateJSON(tc.json, validate))
  )
}
