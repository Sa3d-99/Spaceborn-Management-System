function emailSettings() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.APP_URL?.trim();
  if (!apiKey || !from || !appUrl) return null;
  try {
    const url = new URL(appUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return { apiKey, from, origin: url.origin };
  } catch {
    return null;
  }
}

async function sendEmail({ apiKey, from }, { to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(2500)
  });
  if (response.status === 403) {
    const address = (from.match(/<([^<>]+)>\s*$/)?.[1] || from).trim().toLowerCase();
    const guidance = address.endsWith('@resend.dev')
      ? 'The resend.dev sender is for testing. Set RESEND_FROM_EMAIL to an address on a verified sending domain to reach employees.'
      : 'Check that the sender domain is verified for sending and that the Resend key has permission to use it.';
    throw new Error(`Resend HTTP 403: ${guidance}`);
  }
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
}

module.exports = { emailSettings, sendEmail };
