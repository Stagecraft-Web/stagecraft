import crypto from "crypto";

export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getNetlifyOAuthUrl(state: string): string {
  const clientId = process.env.NETLIFY_CLIENT_ID;
  if (!clientId) throw new Error("NETLIFY_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.AUTH_URL}/api/integrations/netlify/callback`,
    response_type: "code",
    state,
  });

  return `https://app.netlify.com/authorize?${params}`;
}

export async function exchangeNetlifyCode(code: string): Promise<string> {
  const res = await fetch("https://api.netlify.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.NETLIFY_CLIENT_ID,
      client_secret: process.env.NETLIFY_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.AUTH_URL}/api/integrations/netlify/callback`,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };

  if (!data.access_token) {
    throw new Error(data.error ?? "Failed to exchange Netlify code");
  }

  return data.access_token;
}
