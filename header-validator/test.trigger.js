import { validateTrigger } from './validate-json.js'
import { logHeaderListValidation } from './logger.js'
import { validTriggerHeaders, invalidTriggerHeaders } from './data.trigger.js'

// Test trigger headers validation
logHeaderListValidation(validTriggerHeaders, validateTrigger)
logHeaderListValidation(invalidTriggerHeaders, validateTrigger)
