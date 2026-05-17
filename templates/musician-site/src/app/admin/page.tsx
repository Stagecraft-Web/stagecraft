import { redirect } from "next/navigation";

/**
 * `/admin` is just the sidebar's "home" — the Pages panel is the actual
 * landing surface because that's where new sites pick up. Redirecting here
 * keeps the URL stable across content edits.
 */
export default function AdminRoot() {
  redirect("/admin/pages");
}
