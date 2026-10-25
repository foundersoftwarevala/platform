import { expect, test } from "@playwright/test";

const baseUrl = process.env.SV_E2E_BASE;

if (!baseUrl) {
  throw new Error("Set SV_E2E_BASE to a non-production test server URL before running this suite.");
}

for (const path of ["/marketplace", "/marketplace/"]) {
  test(`${path} permanently redirects to /`, async ({ request }) => {
    const requestedUrl = new URL(path, baseUrl);
    const response = await request.get(requestedUrl.toString(), { maxRedirects: 0 });

    expect(response.status()).toBe(301);

    const location = response.headers().location;
    expect(location).toBeTruthy();
    const destination = new URL(location, requestedUrl);
    expect(destination.origin).toBe(requestedUrl.origin);
    expect(destination.pathname).toBe("/");
    expect(destination.search).toBe("");
    expect(destination.hash).toBe("");
  });
}
