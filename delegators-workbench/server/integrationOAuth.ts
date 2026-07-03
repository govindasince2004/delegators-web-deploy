import { scrubSecrets } from './security.js';

export type IntegrationOAuthProvider = 'google_workspace' | 'microsoft_365';

export function oauthCallbackHtml(
  provider: IntegrationOAuthProvider,
  success: boolean,
  message: string
): string {
  const safeMessage = scrubSecrets(message)
    .replace(/ya29\.[A-Za-z0-9._-]+/g, 'ya29.[redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"');
  const payload = JSON.stringify({
    type: 'delegators:integration-oauth',
    provider,
    success,
    message: safeMessage
  });
  const title = provider === 'microsoft_365' ? 'Microsoft 365' : 'Google Workspace';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<script>
  (function () {
    var payload = ${payload};
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
    window.close();
  })();
</script>
<p>${success ? 'Connected. You can close this window.' : 'Connection failed. You can close this window.'}</p>
</body>
</html>`;
}