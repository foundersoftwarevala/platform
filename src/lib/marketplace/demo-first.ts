export function demoFirst<T>(items: readonly T[], hasDemo: (item: T) => boolean): T[] {
  const demos: T[] = [];
  const others: T[] = [];
  for (const item of items) {
    (hasDemo(item) ? demos : others).push(item);
  }
  return [...demos, ...others];
}
