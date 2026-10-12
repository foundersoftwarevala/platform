const QA_PATTERNS = ["qa", "test", "e2e", "dummy", "sample", "placeholder"] as const;
type QaPattern = (typeof QA_PATTERNS)[number];

export type ProductReview = {
  review_required: boolean;
  matched_patterns: QaPattern[];
  reason: string | null;
};

export function productCreationReview(name: string): ProductReview {
  // Recognize TestProduct and QATestPlan, without matching QuoteStudio or Attestation.
  const words = name
    .normalize("NFKC")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const matched = QA_PATTERNS.filter((pattern) => words.includes(pattern));
  return {
    review_required: matched.length > 0,
    matched_patterns: matched,
    reason: matched.length ? "QA/test name detected: keep hidden pending product review." : null,
  };
}

export function productReviewFields(review: ProductReview): {
  visible?: boolean;
  content_status?: string;
  moderation_status?: string;
} {
  return review.review_required
    ? { visible: false, content_status: "in_review", moderation_status: "submitted" }
    : {};
}

export function logProductReview(review: ProductReview, source: string, productId: string): void {
  if (review.review_required) {
    console.warn("[marketplace QA guard]", { source, product_id: productId, ...review });
  }
}

export function isPublicProduct(
  product: { visible?: boolean; content_status?: string } | null | undefined,
): boolean {
  return product?.visible === true && product.content_status === "published";
}
