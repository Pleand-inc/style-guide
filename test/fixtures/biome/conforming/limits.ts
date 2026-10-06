interface Shape {
  kind: string;
}

export function threeParameters(first: number, second: number, third: number) {
  return first + second + third;
}

export const singleTernary = (value: number) => (value > 1 ? "many" : "one");

export const constAssertion = ["circle", "square"] as const;

export const satisfied = { kind: "circle" } satisfies Shape;

export function fourBlocksDeep(values: number[], limit: number) {
  if (limit > 0) {
    for (const value of values) {
      while (value > limit) {
        if (value % 2 === 0) {
          return value;
        }
      }
    }
  }
  return 0;
}

export function sixBranchChain(value: number) {
  let name = "other";
  if (value === 1) {
    name = "one";
  } else if (value === 2) {
    name = "two";
  } else if (value === 3) {
    name = "three";
  } else if (value === 4) {
    name = "four";
  } else if (value === 5) {
    name = "five";
  }
  return name;
}

export function fifteenComplexity(values: number[], limit: number) {
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
      total -= value;
    }
  }
  if (total > limit) {
    total = limit;
  }
  if (total < 0) {
    total = 0;
  }
  return total;
}
