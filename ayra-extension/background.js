const MATCH_URL = "https://softwarevala.net/api/ayra/autofill/match";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "AYRA_MATCH_FIELDS") return false;
  if (sender.id !== chrome.runtime.id || !sender.tab?.id) {
    sendResponse({ error: "The request did not come from the active page." });
    return false;
  }

  (async () => {
    const { connectionToken } = await chrome.storage.local.get("connectionToken");
    if (!connectionToken)
      throw new Error("Connect AYRA first using a token from AYRA Command Center.");

    const response = await fetch(MATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connectionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: message.fields }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `AYRA request failed (${response.status}).`);
    return result;
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ error: error instanceof Error ? error.message : "Could not reach AYRA." });
    });
  return true;
});
