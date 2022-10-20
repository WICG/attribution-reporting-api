import { validateRegisterOsSource, validateRegisterOsTrigger } from './validate-os.js'
import { logHeaderListValidation } from './logger.js'

const osSourceTests = [
  // Valid
  '"https://a.test/"; os-destination="b"; web-destination="https://c.test"',
  '"http://localhost/"; os-destination="b"; web-destination="https://c.test"',
  '"http://127.0.0.1/"; os-destination="b"; web-destination="https://c.test"',

  // Warnings
  '"https://a.test/"; os-destination="b"; web-destination="https://c.test"; x=1',

  // Invalid header syntax
  '!',

  // Not a string
  'x; os-destination="b"; web-destination="https://c.test"',

  // Invalid URL
  '"a.test"; os-destination="b"; web-destination="https://c.test"',

  // Untrustworthy URL
  '"http://a.test"; os-destination="b"; web-destination="https://c.test"',

  // Missing os-destination
  '"https://a.test/"; web-destination="https://c.test"',

  // os-destination not a string
  '"https://a.test/"; os-destination=b; web-destination="https://c.test"',

  // Missing web-destination
  '"https://a.test/"; os-destination="b"',

  // web-destination not a string
  '"http://localhost/"; os-destination="b"; web-destination=b',

  // web-destination invalid URL
  '"https://a.test/"; os-destination="b"; web-destination="c.test"',

  // web-destination untrustworthy URL
  '"https://a.test/"; os-destination="b"; web-destination="http://c.test"',
]

logHeaderListValidation(osSourceTests, validateRegisterOsSource)

/*
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
*/
