/**
 * FAQ content is owned by the database and loaded through the storefront or
 * Manager APIs. This module intentionally contains no browser-local fallback.
 */
export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  published: boolean;
  order: number;
};
