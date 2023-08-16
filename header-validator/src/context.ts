export type PathComponent = string|number

export type Issue = {
  path?: PathComponent[],
  msg: string,
}

export type ValidationResult = {
  errors: Issue[],
  warnings: Issue[],
}

export class Context {
  private readonly path: PathComponent[] = []
  private readonly result: ValidationResult = { errors: [], warnings: [] }

  scope(c: PathComponent, f: () => void): void {
    this.path.push(c)
    f()
    this.path.pop()
  }

  private issue(msg: string): Issue {
    return { msg, path: [...this.path] }
  }

  error(msg: string): void {
    this.result.errors.push(this.issue(msg))
  }

  warning(msg: string): void {
    this.result.warnings.push(this.issue(msg))
  }

  finish(topLevelError?: string): ValidationResult {
    if (typeof topLevelError !== 'undefined') {
      this.result.errors.push({ msg: topLevelError })
    }
    return this.result
  }
}
