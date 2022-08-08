import { validateEligible } from './validate-eligible.js'
import { logHeaderListValidation } from './logger.js'

const tests = [
  // Valid
  '',
  'event-source',
  'trigger',
  'event-source, trigger',
  // Warnings
  'navigation-source',
  'trigger, navigation-source',
  'event-source=(1 2 3)',
  'event-source="x"',
  'event-source; x="y"',
  'event-source="x"; y="z"',
  'event-source=(1 2 3); x="y"',
  // Invalid header syntax
  '!',
  // Not a dictionary
  '"x"',
]

logHeaderListValidation(tests, validateEligible)
