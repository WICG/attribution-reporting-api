import { validateRegisterOsSource, validateRegisterOsTrigger } from './validate-os.js'
import { logHeaderListValidation } from './logger.js'

const osSourceTests = [
  // Valid
  '"https://a.test/"',
  '"http://localhost/"',
  '"http://127.0.0.1/"',

  // Warnings
  '"https://a.test/"; x=1',

  // Invalid header syntax
  '!',

  // Not a string
  'x',

  // Invalid URL
  '"a.test"',

  // Untrustworthy URL
  '"http://a.test"',
]

logHeaderListValidation(osSourceTests, validateRegisterOsSource)

const osTriggerTests = [
  // Valid
  '"https://a.test/"',
  '"http://localhost/"',
  '"http://127.0.0.1/"',

  // Warnings
  '"https://a.test/"; x=1',

  // Invalid header syntax
  '!',

  // Not a string
  'x',

  // Invalid URL
  '"a.test"',

  // Untrustworthy URL
  '"http://a.test/"',
]

logHeaderListValidation(osTriggerTests, validateRegisterOsTrigger)
