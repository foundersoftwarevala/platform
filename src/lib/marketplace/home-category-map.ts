/**
 * Which catalogue row a home page shelf is.
 *
 * The home page groups its shelves by a masterCategory string held in the
 * code; the catalogue groups its products by a row in marketplace_categories.
 * They are the same shelves under two names, and this says which is which so
 * a shelf can be filled with the real products the catalogue holds for it.
 *
 * Three of them do not settle by name alone and are named here on purpose:
 * "Enterprise Resource Planning (ERP)" is the erp row, "Government &
 * e-Governance Systems" is government-services, and "Automobile" is
 * automotive.
 *
 * A shelf with no catalogue row keeps exactly what it has today.
 *
 * Generated from the live catalogue by scripts/ops/home-category-map.mjs.
 */

export const HOME_CATEGORY_SLUG: Record<string, string> = {
  "Education": "education",
  "Retail & POS": "retail-pos",
  "Healthcare": "healthcare",
  "Logistics": "logistics",
  "Real Estate": "real-estate",
  "Finance": "finance-cat",
  "Accounting": "accounting",
  "Sales & CRM": "sales-crm",
  "Marketing": "marketing",
  "HR & Payroll": "hr-payroll",
  "ERP": "erp-cat",
  "Enterprise Resource Planning (ERP)": "erp", // ERP Systems
  "Inventory, Warehouse & Supply Chain": "inventory-warehouse-supply-chain",
  "E-commerce & Online Marketplaces": "ecommerce", // E-commerce
  "Hospitality (Hotel, Restaurant, Travel)": "hospitality-hotel-restaurant-travel",
  "Telecom, Call Center & VoIP": "telecom-call-center-voip",
  "Customer Support & Helpdesk": "customer-support-helpdesk",
  "Legal, Compliance & Documentation": "legal-compliance-documentation",
  "Government & e-Governance Systems": "government-services", // Government Services
  "Security, Surveillance & Access Control": "security-surveillance-access-control",
  "Cyber Security & Data Protection": "cyber-security-data-protection",
  "Insurance": "insurance",
  "Telecom": "telecom", // Telecom & Call Center
  "Warehouse": "warehouse",
  "Rental": "rental",
  "Automobile": "automotive", // Automotive
  "Religious": "religious",
  "Public Utilities": "public-utilities",
  "Defense": "defense",
  "Enterprise Admin": "enterprise-admin",
  "Veterinary": "veterinary",
  "Food Manufacturing": "food-manufacturing",
  "Media & Design": "media-design",
  "Travel": "travel",
  "Academy": "academy",
  "Productivity": "productivity",
  "AI & Automation": "ai-automation",
  "Event": "event-management", // Event Management
  "Construction": "construction",
  "Agriculture": "agriculture-agritech", // Agriculture & Agritech
  "Manufacturing": "manufacturing",
  "Beauty & Wellness": "beauty-wellness",
  "Fitness & Sports": "fitness-sports",
  "Non-Profit & NGO": "non-profit-ngo",
  "Franchise Management": "franchise-management",
  "Recruitment & Staffing": "recruitment-staffing",
  "Photography & Studio": "photography-studio",
  "Consulting & Advisory": "consulting-advisory",
  "Publishing & Print": "publishing-print",
  "Fashion & Apparel": "fashion-apparel",
  "IoT & Smart Devices": "iot-smart-devices",
  "Cloud & DevOps": "cloud-devops",
  "Blockchain & Web3": "blockchain-web3",
  "Gaming & E-Sports": "gaming-e-sports",
  "Podcast & Streaming Media": "podcast-streaming-media",
  "Solar & Green Energy": "solar-green-energy",
  "Waste & Recycling": "waste-recycling",
};

/** The catalogue row for a shelf, or null when the shelf has none. */
export function catalogueSlugForShelf(masterCategory: string): string | null {
  return HOME_CATEGORY_SLUG[masterCategory] ?? null;
}
