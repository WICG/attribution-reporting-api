import { ValidationResult } from './context'
import { Maybe } from './maybe'

export interface Validator<T> {
  validate(input: string): [ValidationResult, Maybe<T>]
  serialize(value: T): string
}

export interface Output extends ValidationResult {
  value?: string
}

export function validate<T>(input: string, validator: Validator<T>): Output {
  const [result, value]: [Output, Maybe<T>] = validator.validate(input)
  value.peek((value) => (result.value = validator.serialize(value)))
  return result
}
