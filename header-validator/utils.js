/**
 * Calls a function n times and returns an array containing the
 * results of each calls.
 *
 * @param {number} n: The number of times to call fn
 * @param {Function} fn: Function to be called n times
 * @returns {Array<T>} Array of size n, containing the values
 * returned by each call
 */
export function times(n, fn) {
  const out = new Array(n)
  for (let i = 0; i < n; ++i) {
    out[i] = fn(i)
  }
  return out
}
