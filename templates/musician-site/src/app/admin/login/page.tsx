type SearchParams = { error?: string; sent?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (params.sent) {
    return (
      <main style={{ maxWidth: "32rem", margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Check your email</h1>
        <p>If that email is allowed for this site, a sign-in link is on its way. The link expires in 10 minutes.</p>
        <p>
          <a href="/admin/login">Back to sign in</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "32rem", margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Sign in</h1>
      {params.error ? (
        <p style={{ color: "#b91c1c" }}>That sign-in link was invalid or expired. Try again.</p>
      ) : null}
      <form action="/api/auth/request" method="POST">
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Email
          <input
            name="email"
            type="email"
            required
            autoFocus
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        <button type="submit" style={{ padding: "0.5rem 1rem" }}>
          Send sign-in link
        </button>
      </form>
    </main>
  );
}
