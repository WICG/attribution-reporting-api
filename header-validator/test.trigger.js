import { validateTrigger, validateJSON } from './validate-json.js'
import { logHeaderListValidation } from './logger.js'
import {
  validTriggerHeadersAsObjects,
  invalidTriggerHeadersAsObjects,
  validTriggerHeadersAsJSON,
  invalidTriggerHeadersAsJSON,
} from './data.trigger.js'

// Test trigger headers validation

// Validate as JSON strings
logHeaderListValidation(
  validTriggerHeadersAsJSON,
  validateTrigger,
  validateJSON
)
logHeaderListValidation(
  invalidTriggerHeadersAsJSON,
  validateTrigger,
  validateJSON
)

// Validate as objects
logHeaderListValidation(validTriggerHeadersAsObjects, validateTrigger)
logHeaderListValidation(invalidTriggerHeadersAsObjects, validateTrigger)
