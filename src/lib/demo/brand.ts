import logo from "@/assets/software-vala-logo.jpg";

/**
 * What a demo shown through softwarevala.net carries in place of the
 * developer's branding: the site's own favicon and logo, and Software Vala's
 * contact details where the demo showed the developer's. Root-relative, so the
 * images resolve on softwarevala.net inside the proxied page. The contact
 * details are the ones the site footer publishes.
 */
export const DEMO_BRAND = {
  favicon: "/favicon.png",
  logo: logo as string,
  name: "Software Vala",
  email: "support@softwarevala.net",
  phone: "+91 83488 38383",
  whatsapp: "https://wa.me/918348838383",
};

export type DemoBrand = typeof DEMO_BRAND;
