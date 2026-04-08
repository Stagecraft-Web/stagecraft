import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@stagecraft/db";

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
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <div>
          <a href="/settings" style={{ marginRight: 16 }}>Settings</a>
          <span>{session.user.name ?? session.user.email}</span>
        </div>
      </header>

      <section style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Your Sites</h2>
          <a
            href="/create"
            style={{
              padding: "8px 16px",
              background: "#0066cc",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            + Create site
          </a>
        </div>
        {sites.length === 0 ? (
          <p>No sites yet. <a href="/create">Create your first musician website</a> to get started.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sites.map((site: { id: string; name: string; status: string; productionUrl: string | null }) => (
              <li key={site.id} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
                <a href={`/sites/${site.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <strong>{site.name}</strong>
                  <span style={{ marginLeft: 8, color: "#666", fontSize: 14 }}>{site.status}</span>
                </a>
                {site.productionUrl && (
                  <div style={{ marginTop: 4 }}>
                    <a href={site.productionUrl} style={{ fontSize: 14, color: "#0066cc" }}>{site.productionUrl}</a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
