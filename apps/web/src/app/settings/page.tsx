import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@stagecraft/db";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  const integrations = await prisma.integrationAccount.findMany({
    where: { userId: session.user.id },
  });

  const github = integrations.find((i: { provider: string }) => i.provider === "github");
  const netlify = integrations.find((i: { provider: string }) => i.provider === "netlify");

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Settings</h1>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      {params.success && (
        <div style={{ padding: 12, background: "#d4edda", borderRadius: 4, marginBottom: 16 }}>
          {params.success === "github_connected" && "GitHub connected successfully."}
          {params.success === "netlify_connected" && "Netlify connected successfully."}
        </div>
      )}

      {params.error && (
        <div style={{ padding: 12, background: "#f8d7da", borderRadius: 4, marginBottom: 16 }}>
          Connection failed. Please try again.
        </div>
      )}

      <section style={{ marginTop: 32 }}>
        <h2>Integrations</h2>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3>GitHub</h3>
          {github ? (
            <p>
              Connected as <strong>{(github.metadata as { login?: string })?.login ?? github.providerAccountId}</strong>
            </p>
          ) : (
            <a href="/api/integrations/github">Connect GitHub</a>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h3>Netlify</h3>
          {netlify ? (
            <p>
              Connected as <strong>{(netlify.metadata as { email?: string })?.email ?? netlify.providerAccountId}</strong>
            </p>
          ) : (
            <a href="/api/integrations/netlify">Connect Netlify</a>
          )}
        </div>
      </section>
    </main>
  );
}
