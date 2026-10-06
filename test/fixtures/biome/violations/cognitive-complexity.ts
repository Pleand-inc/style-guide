export function sixteenComplexity(values: number[], limit: number) {
  let total = 0;
  for (const value of values) {
    if (value > limit) {
      for (const other of values) {
        if (other > value) {
          total += other;
        }
      }
    }
  }
  for (const value of values) {
    if (value < limit) {
      for (const other of values) {
        total -= other;
      }
    }
  }
  return total;
}
