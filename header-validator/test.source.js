import { validateSource, validateJSON } from './validate-json.js'
import { logHeaderListValidation } from './logger.js'
import {
  validSourceHeadersAsObjects,
  invalidSourceHeadersAsObjects,
  validSourceHeadersAsJSON,
  invalidSourceHeadersAsJSON,
} from './data.source.js'

// Test source headers validation

// Validate as JSON strings
logHeaderListValidation(validSourceHeadersAsJSON, validateSource, validateJSON)
logHeaderListValidation(
  invalidSourceHeadersAsJSON,
  validateSource,
  validateJSON
)

// Validate as objects
logHeaderListValidation(validSourceHeadersAsObjects, validateSource)
logHeaderListValidation(invalidSourceHeadersAsObjects, validateSource)
