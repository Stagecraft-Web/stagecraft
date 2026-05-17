import { getSession } from "@/lib/auth";
import { readHeaderConfig } from "@/lib/content";

import { AdminShell } from "@/components/admin/AdminShell";

import { NavigationForm } from "./NavigationForm";

export default async function AdminNavigationPage() {
  const [session, config] = await Promise.all([getSession(), readHeaderConfig()]);
  return (
    <AdminShell activeSection="navigation" email={session?.email ?? ""}>
      <NavigationForm initial={config} />
    </AdminShell>
  );
}
