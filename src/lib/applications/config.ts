/**
 * Role based application system — configuration.
 * Each role has its own sections, fields, fee, agreement, approval
 * workflow and dashboard access.
 */

export type FieldType = "text" | "email" | "tel" | "number" | "url" | "textarea" | "select" | "file" | "checkbox";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  half?: boolean;
};

export type Section = { title: string; note?: string; fields: Field[] };

export type RoleConfig = {
  key: string;
  label: string;
  tagline: string;
  blurb: string;
  accent: string; // tailwind gradient stops
  fee: string;
  feeNote: string;
  workflow: string[];
  agreement: string;
  dashboard: string;
  sections: Section[];
};

const personal: Section = {
  title: "Personal Information",
  fields: [
    { name: "fullName", label: "Full Name", type: "text", required: true, half: true },
    { name: "email", label: "Email Address", type: "email", required: true, half: true },
    { name: "phone", label: "Phone / WhatsApp", type: "tel", required: true, half: true },
    { name: "country", label: "Country", type: "text", required: true, half: true },
    { name: "state", label: "State", type: "text", half: true },
    { name: "city", label: "City", type: "text", half: true },
  ],
};

const identity: Section = {
  title: "Identity Verification",
  note: "Government issued ID — used only for verification.",
  fields: [
    { name: "idType", label: "ID Type", type: "select", options: ["Aadhaar", "PAN", "Passport", "Driving License", "National ID"], required: true, half: true },
    { name: "idNumber", label: "ID Number", type: "text", required: true, half: true },
    { name: "idDocument", label: "Upload ID Document", type: "file", half: true },
    { name: "selfie", label: "Upload Selfie with ID", type: "file", half: true },
  ],
};

const addressVerification: Section = {
  title: "Address Verification",
  fields: [
    { name: "addressLine", label: "Full Address", type: "textarea", required: true },
    { name: "postalCode", label: "Postal Code", type: "text", half: true },
    { name: "addressProof", label: "Upload Address Proof", type: "file", half: true },
  ],
};

const bank: Section = {
  title: "Bank Details",
  note: "Payouts are released to this account after approval.",
  fields: [
    { name: "accountHolder", label: "Account Holder Name", type: "text", required: true, half: true },
    { name: "accountNumber", label: "Account Number", type: "text", required: true, half: true },
    { name: "ifsc", label: "IFSC / SWIFT Code", type: "text", required: true, half: true },
    { name: "bankName", label: "Bank Name & Branch", type: "text", half: true },
    { name: "upi", label: "UPI / PayPal ID", type: "text", half: true },
  ],
};

const company = (required = false): Section => ({
  title: "Company Information",
  fields: [
    { name: "companyName", label: "Company Name", type: "text", required, half: true },
    { name: "companyType", label: "Company Type", type: "select", options: ["Individual", "Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited"], half: true },
    { name: "companyWebsite", label: "Company Website", type: "url", placeholder: "https://", half: true },
    { name: "teamSize", label: "Team Size", type: "number", half: true },
  ],
});

export const ROLES: RoleConfig[] = [
  {
    key: "vendor",
    label: "Become Vendor",
    tagline: "Sell your software catalog on Software Vala",
    blurb: "List and sell your own software products to a global buyer base.",
    accent: "from-cyan-400 to-blue-600",
    fee: "₹4,999",
    feeNote: "One-time onboarding fee, refundable if application is rejected.",
    workflow: ["Application received", "Document & GST verification", "Business call with vendor team", "Agreement signing", "Store activation"],
    agreement: "Vendor Marketplace Agreement — 12 month term, 15% platform commission, 7 day dispatch SLA and mandatory buyer support within 24 hours.",
    dashboard: "Vendor Dashboard — product listings, orders, payouts, support inbox.",
    sections: [
      personal,
      company(true),
      {
        title: "Business Registration",
        fields: [
          { name: "registrationNumber", label: "Registration / CIN Number", type: "text", required: true, half: true },
          { name: "registrationYear", label: "Year of Registration", type: "number", half: true },
          { name: "registrationDoc", label: "Upload Registration Certificate", type: "file", half: true },
        ],
      },
      {
        title: "GST / VAT Information",
        fields: [
          { name: "gstNumber", label: "GST / VAT Number", type: "text", required: true, half: true },
          { name: "taxCountry", label: "Tax Jurisdiction", type: "text", half: true },
          { name: "gstDoc", label: "Upload GST / VAT Certificate", type: "file", half: true },
        ],
      },
      {
        title: "Business Address",
        fields: [
          { name: "businessAddress", label: "Registered Business Address", type: "textarea", required: true },
          { name: "warehouseAddress", label: "Operations / Office Address", type: "textarea" },
        ],
      },
      {
        title: "Contact Details",
        fields: [
          { name: "contactPerson", label: "Primary Contact Person", type: "text", required: true, half: true },
          { name: "contactDesignation", label: "Designation", type: "text", half: true },
          { name: "contactPhone", label: "Business Phone", type: "tel", half: true },
          { name: "contactEmail", label: "Business Email", type: "email", half: true },
        ],
      },
      {
        title: "Marketplace Experience",
        fields: [
          { name: "marketplaceYears", label: "Years Selling Online", type: "number", half: true },
          { name: "otherMarketplaces", label: "Other Marketplaces You Sell On", type: "text", half: true },
          { name: "monthlyRevenue", label: "Current Monthly Revenue", type: "text", half: true },
          { name: "categoriesInterested", label: "Categories Interested", type: "textarea", required: true, placeholder: "ERP, CRM, POS, Healthcare…" },
        ],
      },
      {
        title: "Team Capacity",
        fields: [
          { name: "supportTeamSize", label: "Support Team Size", type: "number", required: true, half: true },
          { name: "salesTeamSize", label: "Sales Team Size", type: "number", required: true, half: true },
        ],
      },
      identity,
      bank,
    ],
  },
  {
    key: "author",
    label: "Become Author",
    tagline: "Publish your code, templates and documentation",
    blurb: "Ship products to thousands of buyers and earn lifetime royalties.",
    accent: "from-violet-400 to-indigo-600",
    fee: "₹2,499",
    feeNote: "One-time author verification fee.",
    workflow: ["Application received", "Portfolio & code review", "Technical interview", "Agreement signing", "Author account activation"],
    agreement: "Author Publishing Agreement — 70/30 royalty split, exclusive listing option, 1 year buyer support commitment and mandatory documentation.",
    dashboard: "Author Dashboard — products, versions, royalties, buyer tickets.",
    sections: [
      personal,
      company(false),
      {
        title: "Development Experience",
        fields: [
          { name: "experienceYears", label: "Years of Development Experience", type: "number", required: true, half: true },
          { name: "teamOrSolo", label: "Working As", type: "select", options: ["Solo Developer", "Small Team", "Agency"], half: true },
          { name: "experienceSummary", label: "Experience Summary", type: "textarea", required: true },
        ],
      },
      {
        title: "Technology Stack",
        fields: [
          { name: "techStack", label: "Primary Tech Stack", type: "textarea", required: true, placeholder: "React, Node.js, Laravel, Flutter…" },
          { name: "languages", label: "Programming Languages", type: "textarea", required: true, placeholder: "JavaScript, PHP, Python, Java…" },
          { name: "databases", label: "Databases", type: "text", half: true },
          { name: "hosting", label: "Hosting / DevOps", type: "text", half: true },
        ],
      },
      {
        title: "Portfolio Links",
        fields: [
          { name: "github", label: "GitHub", type: "url", placeholder: "https://github.com/…", required: true, half: true },
          { name: "website", label: "Website / Portfolio", type: "url", placeholder: "https://", half: true },
          { name: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/…", half: true },
          { name: "demoLinks", label: "Live Demo Links", type: "textarea" },
        ],
      },
      {
        title: "Products & Capability",
        fields: [
          { name: "softwareCategories", label: "Software Categories", type: "textarea", required: true, placeholder: "ERP, School Management, POS…" },
          { name: "productsCount", label: "Products Ready to Publish", type: "number", required: true, half: true },
          { name: "supportCapability", label: "Support Capability", type: "select", options: ["Email only", "Email + Chat", "24/7 Dedicated Support"], required: true, half: true },
          { name: "documentationCapability", label: "Documentation Capability", type: "select", options: ["Basic Readme", "Full User Docs", "Docs + Video Tutorials"], required: true, half: true },
        ],
      },
      identity,
      addressVerification,
      bank,
    ],
  },
  {
    key: "reseller",
    label: "Become Reseller",
    tagline: "Sell our catalog and keep the margin",
    blurb: "Resell 12,000+ ready solutions under your own brand.",
    accent: "from-emerald-400 to-teal-600",
    fee: "₹1,999",
    feeNote: "Annual reseller licence fee.",
    workflow: ["Application received", "Sales capability review", "Territory allocation", "Agreement signing", "Reseller panel access"],
    agreement: "Reseller Agreement — non-exclusive territory, up to 30% margin, quarterly sales target and brand usage guidelines.",
    dashboard: "Reseller Dashboard — catalog, quotations, margin reports, leads.",
    sections: [
      personal,
      {
        title: "Business Profile",
        fields: [
          { name: "companyName", label: "Company Name", type: "text", required: true, half: true },
          { name: "businessType", label: "Business Type", type: "select", options: ["Individual", "IT Services", "Agency", "System Integrator", "Retailer", "Consultant"], required: true, half: true },
          { name: "salesExperience", label: "Sales Experience (years)", type: "number", required: true, half: true },
          { name: "targetMarket", label: "Target Market", type: "text", required: true, half: true, placeholder: "SMB, Enterprise, Education…" },
        ],
      },
      {
        title: "Sales Potential",
        fields: [
          { name: "expectedMonthlySales", label: "Expected Monthly Sales", type: "text", required: true, half: true },
          { name: "customerBase", label: "Current Customer Base Size", type: "number", half: true },
          { name: "marketingChannels", label: "Marketing Channels", type: "textarea", required: true, placeholder: "Field sales, Google Ads, WhatsApp, events…" },
          { name: "website", label: "Website", type: "url", placeholder: "https://", half: true },
          { name: "socialMedia", label: "Social Media Profiles", type: "text", half: true },
        ],
      },
      identity,
      bank,
    ],
  },
  {
    key: "affiliate",
    label: "Become Affiliate",
    tagline: "Earn commission on every referred sale",
    blurb: "Share your link, track clicks and get paid monthly.",
    accent: "from-amber-300 to-orange-600",
    fee: "Free",
    feeNote: "No application fee for affiliates.",
    workflow: ["Application received", "Audience & traffic review", "Agreement acceptance", "Affiliate link issued"],
    agreement: "Affiliate Agreement — 10-25% commission, 60 day cookie window, no brand bidding and monthly payout above ₹2,000.",
    dashboard: "Affiliate Dashboard — links, clicks, conversions, payouts.",
    sections: [
      personal,
      {
        title: "Channels",
        fields: [
          { name: "website", label: "Website", type: "url", placeholder: "https://", half: true },
          { name: "blog", label: "Blog", type: "url", placeholder: "https://", half: true },
          { name: "youtube", label: "YouTube Channel", type: "url", half: true },
          { name: "facebook", label: "Facebook Page", type: "url", half: true },
          { name: "instagram", label: "Instagram", type: "url", half: true },
          { name: "linkedin", label: "LinkedIn", type: "url", half: true },
          { name: "telegram", label: "Telegram", type: "url", half: true },
        ],
      },
      {
        title: "Audience & Promotion",
        fields: [
          { name: "audienceSize", label: "Total Audience Size", type: "number", required: true, half: true },
          { name: "monthlyTraffic", label: "Monthly Traffic / Views", type: "text", required: true, half: true },
          { name: "trafficDetails", label: "Traffic Details", type: "textarea", required: true, placeholder: "Geography, age group, niche, source split…" },
          { name: "promotionMethod", label: "Promotion Method", type: "textarea", required: true, placeholder: "Reviews, tutorials, email list, paid ads…" },
        ],
      },
      identity,
    ],
  },
  {
    key: "franchise",
    label: "Become Franchise",
    tagline: "Run Software Vala in your city",
    blurb: "Own an exclusive territory with full brand and product support.",
    accent: "from-rose-400 to-pink-600",
    fee: "₹49,999",
    feeNote: "Franchise application & territory reservation fee.",
    workflow: ["Application received", "Financial capability check", "Territory availability check", "Head office interview", "Franchise agreement & onboarding"],
    agreement: "Franchise Agreement — 3 year exclusive territory, brand standards, minimum staffing and revenue share of 12%.",
    dashboard: "Franchise Dashboard — territory leads, staff, revenue, training.",
    sections: [
      personal,
      company(true),
      {
        title: "Territory & Investment",
        fields: [
          { name: "territory", label: "Requested Territory / City", type: "text", required: true, half: true },
          { name: "investmentCapacity", label: "Investment Capacity", type: "text", required: true, half: true },
          { name: "officeSpace", label: "Office Space Available", type: "select", options: ["Yes — owned", "Yes — rented", "Planning to acquire"], half: true },
          { name: "staffPlanned", label: "Planned Team Size", type: "number", half: true },
          { name: "businessBackground", label: "Business Background", type: "textarea", required: true },
        ],
      },
      identity,
      addressVerification,
      bank,
    ],
  },
  {
    key: "influencer",
    label: "Become Influencer",
    tagline: "Collaborate on paid campaigns",
    blurb: "Create content, run campaigns and earn per deliverable.",
    accent: "from-fuchsia-400 to-purple-600",
    fee: "Free",
    feeNote: "No fee — campaign based payouts.",
    workflow: ["Application received", "Profile & engagement audit", "Campaign fit call", "Collaboration agreement", "Campaign brief shared"],
    agreement: "Influencer Collaboration Agreement — per campaign deliverables, disclosure compliance and 30 day content usage rights.",
    dashboard: "Influencer Dashboard — campaigns, briefs, deliverables, payouts.",
    sections: [
      personal,
      {
        title: "Social Profiles",
        fields: [
          { name: "instagram", label: "Instagram", type: "url", half: true },
          { name: "youtube", label: "YouTube", type: "url", half: true },
          { name: "linkedin", label: "LinkedIn", type: "url", half: true },
          { name: "xTwitter", label: "X (Twitter)", type: "url", half: true },
        ],
      },
      {
        title: "Reach & Rates",
        fields: [
          { name: "followers", label: "Total Followers", type: "number", required: true, half: true },
          { name: "engagementRate", label: "Average Engagement Rate", type: "text", half: true },
          { name: "niche", label: "Content Niche", type: "text", required: true, half: true },
          { name: "rateCard", label: "Rate Card (per post / video)", type: "text", required: true, half: true },
          { name: "pastBrands", label: "Past Brand Collaborations", type: "textarea" },
        ],
      },
      identity,
    ],
  },
  {
    key: "employee",
    label: "Become Employee",
    tagline: "Join the Software Vala team",
    blurb: "Full-time and remote openings across engineering, sales and support.",
    accent: "from-sky-400 to-cyan-600",
    fee: "Free",
    feeNote: "No fee is ever charged for job applications.",
    workflow: ["Application received", "Resume shortlisting", "Skill assessment", "HR & manager interview", "Offer letter"],
    agreement: "Employment Terms — probation of 3 months, confidentiality and IP assignment as per offer letter.",
    dashboard: "Employee Portal — tasks, attendance, payroll, documents.",
    sections: [
      personal,
      {
        title: "Role Applied For",
        fields: [
          { name: "department", label: "Department", type: "select", options: ["Engineering", "Design", "Sales", "Support", "Marketing", "Operations"], required: true, half: true },
          { name: "position", label: "Position", type: "text", required: true, half: true },
          { name: "workMode", label: "Work Mode", type: "select", options: ["On-site", "Hybrid", "Remote"], half: true },
          { name: "expectedSalary", label: "Expected Salary", type: "text", half: true },
          { name: "noticePeriod", label: "Notice Period", type: "text", half: true },
        ],
      },
      {
        title: "Experience & Documents",
        fields: [
          { name: "totalExperience", label: "Total Experience (years)", type: "number", required: true, half: true },
          { name: "currentCompany", label: "Current / Last Company", type: "text", half: true },
          { name: "skills", label: "Key Skills", type: "textarea", required: true },
          { name: "resume", label: "Upload Resume", type: "file" },
          { name: "linkedin", label: "LinkedIn", type: "url", half: true },
          { name: "portfolio", label: "Portfolio / GitHub", type: "url", half: true },
        ],
      },
      identity,
      bank,
    ],
  },
];

export const getRole = (key: string) => ROLES.find((r) => r.key === key);