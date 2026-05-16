import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getPublicPlatformUrl } from "../platform-url";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.STAGECRAFT_PUBLIC_URL;
  delete process.env.AUTH_URL;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("getPublicPlatformUrl", () => {
  it("returns STAGECRAFT_PUBLIC_URL when set", () => {
    process.env.STAGECRAFT_PUBLIC_URL = "https://stagecraft.website";
    process.env.AUTH_URL = "http://localhost:3000";
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });

  it("falls back to AUTH_URL when STAGECRAFT_PUBLIC_URL is unset", () => {
    process.env.AUTH_URL = "https://stagecraft.website";
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });

  it("strips trailing slash from STAGECRAFT_PUBLIC_URL", () => {
    process.env.STAGECRAFT_PUBLIC_URL = "https://stagecraft.website/";
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });

  it("strips trailing slash from AUTH_URL fallback too", () => {
    process.env.AUTH_URL = "http://localhost:3000/";
    expect(getPublicPlatformUrl()).toBe("http://localhost:3000");
  });

  it("throws when neither env var is set", () => {
    expect(() => getPublicPlatformUrl()).toThrow(
      /Neither STAGECRAFT_PUBLIC_URL nor AUTH_URL is set/,
    );
  });

  it("treats empty STAGECRAFT_PUBLIC_URL as 'not set' and falls back to AUTH_URL", () => {
    // Real-world: .op.env can leave a var as `STAGECRAFT_PUBLIC_URL=`
    // when the operator unset it. Falling back to AUTH_URL keeps dev
    // working rather than throwing on an empty string.
    process.env.STAGECRAFT_PUBLIC_URL = "";
    process.env.AUTH_URL = "http://localhost:3000";
    expect(getPublicPlatformUrl()).toBe("http://localhost:3000");
  });
});
