export function total(values: number[]) {
  const count = values.length;
  return values.reduce((sum, value) => sum + value, 0);
}
