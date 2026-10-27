export function demoCategoryMatches(
  productCategoryId: string | null | undefined,
  detectedCategoryId: string | null | undefined,
): boolean {
  return Boolean(
    productCategoryId && detectedCategoryId && productCategoryId === detectedCategoryId,
  );
}
