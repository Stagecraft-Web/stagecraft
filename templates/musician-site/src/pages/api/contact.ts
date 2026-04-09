export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";
import { getSiteConfig } from "../../lib/content";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 3;
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = recentRequests.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recentRequests.set(ip, recent);
  if (recent.length >= MAX_REQUESTS) return true;
  recent.push(now);
  return false;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Rate limit by IP
  if (isRateLimited(clientAddress)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Contact form is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Honeypot check
  const honeypot = data.get("website")?.toString() ?? "";
  if (honeypot) {
    // Silently accept to not reveal the honeypot
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const name = data.get("name")?.toString().trim() ?? "";
  const email = data.get("email")?.toString().trim() ?? "";
  const subject = data.get("subject")?.toString().trim() || "New contact form message";
  const message = data.get("message")?.toString().trim() ?? "";

  // Validate required fields
  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ error: "Name, email, and message are required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "Please enter a valid email address." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const site = getSiteConfig();
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: `${site.artistName} Website <onboarding@resend.dev>`,
      to: site.contactEmail,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        "",
        message,
      ].join("\n"),
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[contact] Failed to send email:", err);
    return new Response(
      JSON.stringify({ error: "Failed to send message. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
