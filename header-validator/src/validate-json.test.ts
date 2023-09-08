import * as testutil from './util.test'
import * as json from './validate-json'

export type TestCase = testutil.TestCase & {
  name: string
  json: string
  vsv?: Partial<json.VendorSpecificValues>
}
