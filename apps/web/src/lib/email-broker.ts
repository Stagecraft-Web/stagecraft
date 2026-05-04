import { Resend } from "resend";

/**
 * Send an email using the platform's shared Resend account. Used by the
 * broker route to send transactional emails (currently magic-link sign-in)
 * on behalf of an artist site, so each artist site doesn't need its own
 * RESEND_API_KEY env var.
 *
 * Returns ok:true with the Resend message id on success. ok:false with
 * a code on failure — keep the error surface narrow so the route handler
 * can return a stable shape to the artist site.
 */
export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; code: "not-configured" | "send-failed"; message: string };

export async function sendBrokeredEmail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAGIC_LINK_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      code: "not-configured",
      message: "Platform RESEND_API_KEY or MAGIC_LINK_FROM is not set",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });
    if (error) {
      return { ok: false, code: "send-failed", message: error.message };
    }
    return { ok: true, messageId: data?.id ?? "" };
  } catch (cause) {
    return {
      ok: false,
      code: "send-failed",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
