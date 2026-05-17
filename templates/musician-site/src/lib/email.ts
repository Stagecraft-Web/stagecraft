import { Resend } from "resend";

/**
 * Resend's sandbox sender. Works without a verified domain — every
 * artist can send from this on day one. Artists who connect their own
 * verified domain on the platform get `MAGIC_LINK_FROM` set explicitly
 * to override.
 */
const MAGIC_LINK_FROM_DEFAULT = "onboarding@resend.dev";

/**
 * Send the magic-link email via Resend. `RESEND_API_KEY` is provisioned
 * per-site by the platform's /create flow from the artist's own Resend
 * account (set up at /settings on the platform), so each artist site
 * uses its owner's account end-to-end — the platform never sees
 * recipient addresses or sends mail on behalf of any artist.
 *
 * `MAGIC_LINK_FROM` defaults to Resend's sandbox sender; artists who
 * have a verified domain get it provisioned explicitly so emails come
 * from their own domain.
 *
 * In local dev RESEND_API_KEY is typically unset and we log to stderr
 * instead of sending.
 */
export async function sendMagicLink(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[dev] Magic link for ${email}: ${url}`);
    return;
  }
  const from = process.env.MAGIC_LINK_FROM || MAGIC_LINK_FROM_DEFAULT;
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to your site",
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
  });
}
