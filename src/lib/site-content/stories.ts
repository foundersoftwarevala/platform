/**
 * Customer success stories.
 *
 * Structured so the frontend never has to change when these become real
 * marketplace records: `listStories` is the single source, and a story links to
 * a product only when `productSlug` names a listing that exists.
 */

export type Story = {
  company: string;
  quote: string;
  author: string;
  role: string;
  metric: string;
  metricLabel: string;
  product: string;
  /** Set only when the product is a real listing in the catalogue. */
  productSlug?: string;
};

export const STORIES: Story[] = [
  {
    company: "Apollo Clinics",
    quote: "MediCore 360 cut patient onboarding from 12 min to 90 sec across 42 branches.",
    author: "Dr. Neha R.",
    role: "CIO",
    metric: "-87%",
    metricLabel: "wait time",
    product: "MediCore 360",
  },
  {
    company: "GreenLeaf Schools",
    quote: "EduFlow Pro replaced 6 tools. Teachers got 9 hours back per week.",
    author: "Rakesh M.",
    role: "Principal",
    metric: "9 hrs",
    metricLabel: "saved per week",
    product: "EduFlow Pro",
  },
  {
    company: "Coastal Stays",
    quote: "HotelNest pushed our direct bookings from 18% to 54% in one quarter.",
    author: "Anita V.",
    role: "Owner",
    metric: "+200%",
    metricLabel: "direct bookings",
    product: "HotelNest",
  },
];

export const listStories = () => STORIES;
