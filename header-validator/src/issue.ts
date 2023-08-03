export type PathComponent = string|number

export type Issue = {
  msg: string,
  path?: Array<PathComponent>,
}

export type ValidationResult = {
  errors: Array<Issue>,
  warnings: Array<Issue>,
}
