type SearchParams = { error?: string; sent?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (params.sent) {
    return (
      <main
        style={{
          maxWidth: "var(--max-width-narrow)",
          margin: "var(--space-16) auto",
          padding: "0 var(--space-4)",
        }}
      >
        <h1>Check your email</h1>
        <p>If that email is allowed for this site, a sign-in link is on its way. The link expires in 10 minutes.</p>
        <p>
          <a href="/admin/login">Back to sign in</a>
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "var(--max-width-narrow)",
        margin: "var(--space-16) auto",
        padding: "0 var(--space-4)",
      }}
    >
      <h1>Sign in</h1>
      {params.error ? (
        <p style={{ color: "var(--color-text-error)" }}>That sign-in link was invalid or expired. Try again.</p>
      ) : null}
      <form action="/api/auth/request" method="POST">
        <label style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Email
          <input
            name="email"
            type="email"
            required
            autoFocus
            style={{
              display: "block",
              width: "100%",
              padding: "var(--space-2)",
              marginTop: "var(--space-1)",
            }}
          />
        </label>
        <button type="submit" style={{ padding: "var(--space-2) var(--space-4)" }}>
          Send sign-in link
        </button>
      </form>
    </main>
  );
}
