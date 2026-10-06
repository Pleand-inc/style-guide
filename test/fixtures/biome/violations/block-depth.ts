export function fiveBlocksDeep(values: number[], limit: number) {
  if (limit > 0) {
    for (const value of values) {
      while (value > limit) {
        if (value % 2 === 0) {
          if (value % 3 === 0) {
            return value;
          }
        }
      }
    }
  }
  return 0;
}
