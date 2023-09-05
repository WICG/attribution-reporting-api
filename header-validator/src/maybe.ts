export type Maybeable<T> = T | Maybe<T>

export class Maybe<T> {
  static readonly None: Maybe<any> = new Maybe()

  static some<T>(t: T): Maybe<T> {
    return new Maybe(t)
  }

  static flatten<T>(t: Maybeable<T>): Maybe<T> {
    return t instanceof Maybe ? t : Maybe.some(t)
  }

  private constructor(private readonly t?: T) {}

  filter(f: (t: T) => boolean): Maybe<T> {
    return this.t === undefined || !f(this.t) ? Maybe.None : this
  }

  map<U>(f: (t: T) => Maybeable<U>): Maybe<U> {
    return this.t === undefined ? Maybe.None : Maybe.flatten(f(this.t))
  }

  peek(f: (t: T) => void): Maybe<T> {
    if (this.t !== undefined) {
      f(this.t)
    }
    return this
  }
}
