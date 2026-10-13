export function analyzeRequirement(text: string) {
  const features = [];
  if (/payment|stripe|paypal|checkout/i.test(text)) features.push("Payment Integration");
  if (/auth|login|signup|user/i.test(text)) features.push("User Authentication");
  if (/email|notification|newsletter/i.test(text)) features.push("Email Notifications");
  if (/search|filter/i.test(text)) features.push("Search & Filtering");
  if (/mobile|responsive/i.test(text)) features.push("Mobile Responsiveness");
  if (/dashboard|admin/i.test(text)) features.push("Admin Dashboard");
  if (/database|storage/i.test(text)) features.push("Data Storage");
  
  const optional = [];
  if (/blog|news/i.test(text)) optional.push("Blog System");
  if (/chat|support/i.test(text)) optional.push("Live Chat");
  
  const deployment = [];
  if (/cloud|aws|vercel|docker/i.test(text)) deployment.push("Cloud Deployment");
  else deployment.push("Standard VPS");

  const questions = [];
  if (!/payment|stripe|paypal|checkout/i.test(text)) questions.push("Will the site need to accept payments?");
  if (!/language|i18n|translate/i.test(text)) questions.push("Should the site support multiple languages?");
  if (!/auth|login|signup|user/i.test(text)) questions.push("Do you need user accounts/login?");
  if (!/contact|form/i.test(text)) questions.push("Does the site need a contact form?");

  return { features, optional, deployment, questions };
}
