import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@stagecraft/db";
import Button from "@/components/Button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ maxWidth: "var(--max-width-wide)", margin: "var(--space-10) auto", fontFamily: "var(--font-body)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <div>
          <a href="/settings" style={{ marginRight: "var(--space-4)" }}>Settings</a>
          <span style={{ marginRight: "var(--space-4)" }}>{session.user.name ?? session.user.email}</span>
          <a href="/api/auth/signout" style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Sign out</a>
        </div>
      </header>

      <section style={{ marginTop: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Your Sites</h2>
          <Button href="/create" size="sm">+ Create site</Button>
        </div>
        {sites.length === 0 ? (
          <p>No sites yet. <a href="/create">Create your first musician website</a> to get started.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sites.map((site: { id: string; name: string; status: string; productionUrl: string | null }) => (
              <li key={site.id} style={{
                padding: "var(--space-4)",
                border: `1px solid var(--color-border)`,
                borderRadius: "var(--radius-lg)",
                marginBottom: "var(--space-3)",
                opacity: site.status === "archived" ? 0.6 : 1,
              }}>
                <a href={`/sites/${site.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <strong>{site.name}</strong>
                  <span style={{ marginLeft: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{site.status}</span>
                </a>
                {site.productionUrl && site.status !== "archived" && (
                  <div style={{ marginTop: "var(--space-1)" }}>
                    <a href={site.productionUrl} style={{ fontSize: "var(--font-size-sm)", color: "var(--color-brand)" }}>{site.productionUrl}</a>
                  </div>
                )}
                <div
                  role="note"
                  style={{
                    marginTop: "var(--space-3)",
                    padding: `var(--space-2) var(--space-3)`,
                    background: "var(--color-warning-bg)",
                    border: "1px solid var(--color-warning)",
                    borderRadius: "var(--radius)",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-warning)",
                  }}
                >
                  <strong>Contact form setup required:</strong> Add a{" "}
                  <code>RESEND_API_KEY</code> environment variable in your Netlify site settings to
                  enable the contact form. Get a free API key at{" "}
                  <a href="https://resend.com" style={{ color: "var(--color-warning)" }}>
                    resend.com
                  </a>
                  .
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
