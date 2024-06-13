export class Maybe<T> {
  static readonly None = new Maybe<never>()

  static some<T>(this: void, t: T): Maybe<T> {
    return new Maybe(t)
  }

  private constructor(private readonly t?: T) {}

  filter<C extends unknown[]>(
    f: (t: T, ...args: C) => boolean,
    ...args: C
  ): Maybe<T> {
    return this.t === undefined || !f(this.t, ...args) ? Maybe.None : this
  }

  map<U, C extends unknown[]>(
    f: (t: T, ...args: C) => U,
    ...args: C
  ): Maybe<U> {
    return this.t === undefined ? Maybe.None : new Maybe<U>(f(this.t, ...args))
  }

  flatMap<U, C extends unknown[]>(
    f: (t: T, ...args: C) => Maybe<U>,
    ...args: C
  ): Maybe<U> {
    return this.t === undefined ? Maybe.None : f(this.t, ...args)
  }

  peek<C extends unknown[]>(f: (t: T, ...args: C) => void, ...args: C): this {
    if (this.t !== undefined) {
      f(this.t, ...args)
    }
    return this
  }

  get value(): T | undefined {
    return this.t
  }
}
