const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => value.replace(/[&<>"']/g, character => htmlEntities[character]);

function passwordResetMessage(url, expiresInMinutes, employeeId) {
  const setup = employeeId !== undefined;
  const subject = setup ? 'Your Spaceborn signup was approved' : 'Reset your Spaceborn password';
  const heading = setup ? 'Create your password' : 'Reset your password';
  const action = setup ? 'Create Password' : 'Reset Password';
  const instructions = setup
    ? `Your Spaceborn CRM account has been approved. Your employee ID is ${employeeId}. Create a password to sign in.`
    : 'Use this secure link to choose a new password for your Spaceborn CRM account.';
  const link = url.href;
  const escapedLink = escapeHtml(link);
  const expiration = `This link expires in ${expiresInMinutes} minutes and can be used once.`;
  const ignore = setup
    ? 'If you did not request a Spaceborn CRM account, you can safely ignore this email.'
    : 'If you did not request a password reset, you can safely ignore this email.';
  return {
    subject,
    text: [
      setup ? heading : subject,
      instructions,
      link,
      expiration,
      ignore
    ].join('\n\n'),
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;color:#171717;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:16px;">
          <tr><td style="padding:30px 32px 20px;border-bottom:1px solid #e5e5e5;">
            <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:1px;color:#111111;">SPACEBORN</p>
          </td></tr>
          <tr><td style="padding:28px 32px 32px;">
            <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#111111;">${heading}</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#404040;">${escapeHtml(instructions)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
              <tr><td bgcolor="#111111" style="background-color:#111111;border-radius:8px;">
                <a href="${escapedLink}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;line-height:20px;text-decoration:none;border-radius:8px;background-color:#111111;color:#ffffff;">${action}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#525252;">${expiration}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#525252;">${ignore}</p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#525252;">If the button does not open, copy this link into your browser:<br>
              <a href="${escapedLink}" style="color:#222222;word-break:break-all;">${escapedLink}</a>
            </p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  };
}

module.exports = { passwordResetMessage };
