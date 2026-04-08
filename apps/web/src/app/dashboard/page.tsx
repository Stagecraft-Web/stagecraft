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
        <span>{session.user.name ?? session.user.email}</span>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2>Your Sites</h2>
        {sites.length === 0 ? (
          <p>No sites yet. Create your first musician website to get started.</p>
        ) : (
          <ul>
            {sites.map((site) => (
              <li key={site.id}>
                <strong>{site.name}</strong> — {site.status}
                {site.productionUrl && (
                  <>
                    {" "}
                    — <a href={site.productionUrl}>{site.productionUrl}</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
