/**
 * Vala Academy course content.
 *
 * These are the approved course descriptions for the storefront. They are held
 * here as structured content rather than in a database because there is no
 * learning-management backend yet: no lessons are stored, no progress is
 * tracked, and the pages must never imply otherwise.
 *
 * When a real courses table exists, `listCourses` is the only function that has
 * to change.
 */

export type Course = {
  slug: string;
  title: string;
  summary: string;
  lessons: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  /** What a learner can actually do at the end. */
  outcomes: string[];
  /** The application role this course prepares someone for, if any. */
  appliesTo?: string;
};

export const COURSES: Course[] = [
  {
    slug: "marketplace-foundations",
    title: "Marketplace Foundations",
    summary:
      "How the Software Vala marketplace works end to end — categories, demos, the lifetime licence, delivery and support.",
    lessons: 24,
    level: "Beginner",
    outcomes: [
      "Navigate the catalogue and shortlist products for a business",
      "Run a live demo and read a product's stack and modules",
      "Understand what the lifetime licence covers",
    ],
  },
  {
    slug: "vendor-mastery",
    title: "Vendor Mastery",
    summary:
      "Publishing and selling your own products on the marketplace: listing quality, demos, pricing and buyer communication.",
    lessons: 38,
    level: "Intermediate",
    outcomes: [
      "Prepare a listing that passes the quality gate",
      "Set up a reliable live demo for your product",
      "Handle buyer questions and post-sale support",
    ],
    appliesTo: "vendor",
  },
  {
    slug: "enterprise-implementation",
    title: "Enterprise Implementation",
    summary:
      "Delivering marketplace products inside larger organisations — migration, environments, roles and rollout.",
    lessons: 52,
    level: "Advanced",
    outcomes: [
      "Plan a migration from an existing system",
      "Set up environments, roles and access for a large team",
      "Run a phased rollout and hand over to an internal team",
    ],
  },
];

export const listCourses = () => COURSES;
export const getCourse = (slug: string) => COURSES.find((c) => c.slug === slug);
