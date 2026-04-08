import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Stagecraft</h1>
      <p>AI-powered musician website platform.</p>
      <a href="/login">Sign in with GitHub</a>
    </main>
  );
}
