AYRA Universal Auto-Fill Chrome Extension

Install
1. Download ayra-extension.zip and extract it to a folder.
2. In Chrome, open chrome://extensions.
3. Turn on Developer mode.
4. Click Load unpacked and select the extracted ayra-extension folder.
5. In Software Vala, open AYRA Command Center > Company Profile.
6. Save verified company details, then click Generate 24-hour connection token.
7. Copy the token, click the AYRA extension icon, paste it, and click Save connection.
8. Open the target website, click the extension icon, then click Fill with Software Vala Details.

Safety and permissions
- The extension requests activeTab, scripting, storage, and network access only to softwarevala.net.
- It sends field labels and identifiers (not page HTML or field values) to the AYRA VPS API.
- A one-time connection token is stored as a hash on VPS Postgres, expires in 24 hours,
  and is revoked when a replacement token is created.
- Only supported empty fields are filled. Sensitive-looking fields are skipped.
  The extension never submits a form. Review every value before submitting yourself.
- Chrome internal pages and browser-protected pages do not permit script injection.
