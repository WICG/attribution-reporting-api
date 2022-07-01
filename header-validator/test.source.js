import { validateSource } from './validate-json.js'
import { logHeaderListValidation } from './logger.js'
import { validSourceHeaders, invalidSourceHeaders } from './data.source.js'

// Test source headers validation
logHeaderListValidation(validSourceHeaders, validateSource)
logHeaderListValidation(invalidSourceHeaders, validateSource)
