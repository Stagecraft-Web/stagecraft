import { Resend } from "resend";

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[dev] Magic link for ${email}: ${url}`);
    return;
  }
  const from = process.env.MAGIC_LINK_FROM ?? "noreply@example.com";
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to your site",
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
  });
}
