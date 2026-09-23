/**
 * E-mails a customer receives (src/lib/commerce/mailer.ts), translated on the
 * server with serverTranslator(). Notifications to the platform's own
 * operators are not listed: they are written for the team, in English.
 * English only.
 */
export const EMAIL_MESSAGES = {
  "email.hello": "Hello {name},",

  // Enquiry received (lead acknowledgement)
  "email.lead.subject_product": "We have your request — {product}",
  "email.lead.subject": "We have your request — Software Vala",
  "email.lead.heading": "We have your request",
  "email.lead.thanks": [
    "Thank you for asking for {action, select, request_demo {a demo} notify_me {an update when it is available} callback {a call back} buy_intent {to buy} other {more information}}.",
    "what the visitor asked for on the website",
  ],
  "email.lead.thanks_product": [
    "Thank you for asking for {action, select, request_demo {a demo} notify_me {an update when it is available} callback {a call back} buy_intent {to buy} other {more information}} about {product}.",
    "what the visitor asked for, about which product",
  ],
  "email.lead.follow_up":
    "Our team has your request and will come back to you on this email and on WhatsApp.",
  "email.lead.urgent": "If it is urgent, message us directly on WhatsApp {phone}.",

  // Licence issued
  "email.licence.subject": "Your {product} licence — Software Vala",
  "email.licence.heading": "Your licence is ready",
  "email.licence.confirmed": "Your payment is confirmed and your licence is ready.",
  "email.licence.greeting": "Hello {name}, your payment is confirmed.",
  "email.licence.key": "Licence key: {key}",
  "email.licence.order": "Order {order}",
  "email.licence.next_steps":
    "Our team will contact you on this email and on WhatsApp to collect your domain, hosting and branding, and to complete the setup for you.",
} as const;
