export type Maybe<T> = typeof None | Some<T>

export const None = {
  filter: () => None,
  map: () => None,
  flatMap: () => None,
  peek: () => None,
}

export class Some<T> {
  constructor(private readonly t: T) {}

  filter(f: (t: T) => boolean): Maybe<T> {
    return f(this.t) ? this : None
  }

  map<U>(f: (t: T) => U): Some<U> {
    return new Some(f(this.t))
  }

  flatMap<U>(f: (t: T) => Maybe<U>): Maybe<U> {
    return f(this.t)
  }

  peek(f: (t: T) => void): Some<T> {
    f(this.t)
    return this
  }
}
