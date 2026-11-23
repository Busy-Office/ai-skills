// Kept for the old CSV importer; nothing in src/api uses it.
export function total(xs) {
  return xs.reduce((a, b) => a + b, 0);
}
