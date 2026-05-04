/**
 * Send the magic-link email. In production we route through the platform's
 * broker (`POST $STAGECRAFT_PLATFORM_URL/api/broker/send-email`) so the
 * platform's shared Resend account is the only place an API key lives —
 * artists never get the platform's RESEND_API_KEY in their env.
 *
 * The broker is authenticated with the per-site STAGECRAFT_BROKER_SECRET
 * and pins the recipient to the site owner's email; outside the platform
 * configuration (local dev, missing env), we log to stderr instead.
 */
export async function sendMagicLink(email: string, url: string): Promise<void> {
  const platformUrl = process.env.STAGECRAFT_PLATFORM_URL?.replace(/\/$/, "");
  const siteId = process.env.STAGECRAFT_SITE_ID;
  const brokerSecret = process.env.STAGECRAFT_BROKER_SECRET;

  if (!platformUrl || !siteId || !brokerSecret) {
    console.log(`[dev] Magic link for ${email}: ${url}`);
    return;
  }

  const res = await fetch(`${platformUrl}/api/broker/send-email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${brokerSecret}`,
    },
    body: JSON.stringify({
      siteId,
      to: email,
      subject: "Sign in to your site",
      text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email broker rejected request (${res.status}): ${body.slice(0, 300)}`);
  }
}
