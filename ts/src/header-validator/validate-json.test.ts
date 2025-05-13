import * as testutil from './util.test'
import * as vsv from '../vendor-specific-values'

export type TestCase<T> = testutil.TestCase<T> & {
  vsv?: Readonly<Partial<vsv.VendorSpecificValues>>
  parseNamedBudgets?: boolean
}
