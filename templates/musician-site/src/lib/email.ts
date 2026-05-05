import { Resend } from "resend";

/**
 * Send the magic-link email via Resend. Both `RESEND_API_KEY` and
 * `MAGIC_LINK_FROM` are provisioned per-site by the platform's /create
 * flow from the artist's own Resend account (set up at /settings on the
 * platform), so each artist site uses its owner's account end-to-end —
 * the platform never sees recipient addresses or sends mail on behalf
 * of any artist.
 *
 * In local dev, both env vars are typically unset and we log to stderr
 * instead of sending.
 */
export async function sendMagicLink(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAGIC_LINK_FROM;
  if (!apiKey || !from) {
    console.log(`[dev] Magic link for ${email}: ${url}`);
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to your site",
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
  });
}
