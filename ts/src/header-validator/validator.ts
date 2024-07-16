import { ValidationResult } from './context'
import { Maybe } from './maybe'
import * as toJson from './to-json'
import * as json from './validate-json'

export interface Validator<T> {
  validate(input: string): [ValidationResult, Maybe<T>]
  serialize(value: T): string
}

export function source(
  opts: Readonly<json.SourceOptions>
): Validator<json.Source> {
  return {
    validate: (input) => json.validateSource(input, opts),
    serialize: (value) => toJson.serializeSource(value, opts),
  }
}

export function trigger(
  opts: Readonly<json.RegistrationOptions>
): Validator<json.Trigger> {
  return {
    validate: (input) => json.validateTrigger(input, opts),
    serialize: (value) => toJson.serializeTrigger(value, opts),
  }
}

export interface Output extends ValidationResult {
  value?: string
}

export function validate<T>(input: string, validator: Validator<T>): Output {
  const [result, value]: [Output, Maybe<T>] = validator.validate(input)
  value.peek((value) => (result.value = validator.serialize(value)))
  return result
}
