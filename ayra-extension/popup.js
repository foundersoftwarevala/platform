const tokenInput = document.getElementById("token");
const connectButton = document.getElementById("connect");
const disconnectButton = document.getElementById("disconnect");
const fillButton = document.getElementById("fill");
const status = document.getElementById("status");

async function refreshState() {
  const { connectionToken } = await chrome.storage.local.get("connectionToken");
  fillButton.disabled = !connectionToken;
  status.textContent = connectionToken
    ? "AYRA is connected in this browser profile."
    : "Connect AYRA to enable autofill.";
}

connectButton.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!/^ayra_ext_[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = "That connection token is not valid.";
    return;
  }
  await chrome.storage.local.set({ connectionToken: token });
  tokenInput.value = "";
  await refreshState();
});

disconnectButton.addEventListener("click", async () => {
  await chrome.storage.local.remove("connectionToken");
  await refreshState();
});

fillButton.addEventListener("click", async () => {
  fillButton.disabled = true;
  status.textContent = "Scanning the active page…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
      throw new Error("Open a regular website tab, then try again.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const result = await chrome.tabs.sendMessage(tab.id, { type: "AYRA_START_FILL" });
    if (!result?.ok) throw new Error(result?.error || "Could not fill this page.");
    status.textContent = result.message;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Could not fill this page.";
  } finally {
    await refreshState();
  }
});

void refreshState();
