/**
 * Awards & Champions.
 *
 * Held in one place so the categories and winners can be updated without
 * touching component code. A winner links to a marketplace product only when
 * `productSlug` is set and that product genuinely exists — otherwise the card
 * stays informational rather than linking somewhere that does not resolve.
 */

export type Award = {
  category: string;
  winner: string;
  /** Set only when the winner is a real listing in the catalogue. */
  productSlug?: string;
  year: number;
};

export const AWARD_YEAR = 2025;

export const AWARDS: Award[] = [
  { category: "Vendor of the Year", winner: "MediCore Labs", year: AWARD_YEAR },
  { category: "Fastest Growing App", winner: "ShopEngine", year: AWARD_YEAR },
  { category: "Editor's Choice", winner: "EduFlow Pro", year: AWARD_YEAR },
  { category: "Most Loved by Users", winner: "HotelNest", year: AWARD_YEAR },
];

export const listAwards = () => AWARDS;
