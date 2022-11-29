/**
 * Invokes iteratee n times, returning an array of the results
 * of each invocation. The iteratee is invoked with one argument;
 * (index).
 *
 * @param {number} n: The number of times to invoke iteratee
 * @param {Function} iteratee: Function called n times whose
 * results will be returned.
 * @returns (Array): Returns the array of results
 */
export function times(n, iteratee) {
  const out = new Array(n)
  for (let i = 0; i < n; ++i) {
    out[i] = iteratee(i)
  }
  return out
}
