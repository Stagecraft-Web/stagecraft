import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@stagecraft/db";

import { ConnectResend } from "./ConnectResend";
import { ConnectVercel } from "./ConnectVercel";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  const githubAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL ?? null;

  const integrations = await prisma.integrationAccount.findMany({
    where: { userId: session.user.id },
  });

  const github = integrations.find((i: { provider: string }) => i.provider === "github");
  const netlify = integrations.find((i: { provider: string }) => i.provider === "netlify");
  const vercel = integrations.find((i: { provider: string }) => i.provider === "vercel");
  const resend = integrations.find((i: { provider: string }) => i.provider === "resend");
  const vercelUsername =
    vercel?.metadata && typeof vercel.metadata === "object" && vercel.metadata !== null
      ? (vercel.metadata as { username?: string }).username ?? null
      : null;
  // Connected admin email = providerAccountId on the Resend
  // IntegrationAccount (set during /connect to the verified address).
  // Mirrors User.email; shown as the connected-state indicator.
  const resendAdminEmail = resend?.providerAccountId ?? null;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Settings</h1>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      {params.success && (
        <div style={{ padding: 12, background: "#d4edda", borderRadius: 4, marginBottom: 16 }}>
          {params.success === "github_connected" && "GitHub connected successfully."}
          {params.success === "netlify_connected" && "Netlify connected successfully."}
          {params.success === "vercel_connected" && "Vercel connected successfully."}
          {params.success === "vercel_disconnected" && "Vercel disconnected."}
          {params.success === "resend_connected" && "Resend connected successfully."}
          {params.success === "resend_disconnected" && "Resend disconnected."}
        </div>
      )}

      {params.error && (
        <div style={{ padding: 12, background: "#f8d7da", borderRadius: 4, marginBottom: 16 }}>
          Connection failed. Please try again.
        </div>
      )}

      <section style={{ marginTop: 32 }}>
        <h2>Integrations</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          GitHub is required (the platform commits to your repo). For deploys, connect either Vercel or Netlify — Vercel is recommended for new sites because its API auto-resolves repo linking; Netlify needs manual GitHub-App setup per repo. Resend is required for magic-link sign-in on artist sites.
        </p>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3>GitHub</h3>
          {github ? (
            <p>
              Connected as <strong>{(github.metadata as { login?: string })?.login ?? github.providerAccountId}</strong>
            </p>
          ) : (
            <p style={{ color: "#666" }}>Sign in with GitHub to connect.</p>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3>Vercel <span style={{ fontSize: 12, color: "#0070f3", fontWeight: 400 }}>(recommended)</span></h3>
          <ConnectVercel connectedUsername={vercelUsername} />
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3>Netlify</h3>
          {netlify ? (
            <p>
              Connected as <strong>{(netlify.metadata as { email?: string })?.email ?? netlify.providerAccountId}</strong>
            </p>
          ) : (
            <a href="/api/integrations/netlify">Connect Netlify</a>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h3>Resend <span style={{ fontSize: 12, color: "#666", fontWeight: 400 }}>(required for magic-link sign-in)</span></h3>
          <ConnectResend connectedAdminEmail={resendAdminEmail} />
        </div>

        {githubAppInstallUrl && (
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 }}>
            <h3>Stagecraft GitHub App</h3>
            <p style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
              Installing the Stagecraft App on your GitHub account lets the platform
              manage repos without a per-site connection step. Select &ldquo;All repositories&rdquo;
              for the smoothest experience.
            </p>
            <a
              href={githubAppInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600 }}
            >
              Install Stagecraft App &rarr;
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
