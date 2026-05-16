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
  it("returns the hardcoded prod URL when STAGECRAFT_PUBLIC_URL is unset (dev default)", () => {
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });

  it("returns STAGECRAFT_PUBLIC_URL when explicitly set (override for staging/fork)", () => {
    process.env.STAGECRAFT_PUBLIC_URL = "https://staging.stagecraft.website";
    expect(getPublicPlatformUrl()).toBe("https://staging.stagecraft.website");
  });

  it("strips trailing slash from STAGECRAFT_PUBLIC_URL override", () => {
    process.env.STAGECRAFT_PUBLIC_URL = "https://staging.stagecraft.website/";
    expect(getPublicPlatformUrl()).toBe("https://staging.stagecraft.website");
  });

  it("treats empty STAGECRAFT_PUBLIC_URL as 'not set' and falls back to the default", () => {
    // Real-world: .op.env can leave a var as `STAGECRAFT_PUBLIC_URL=`
    // when the operator unset it. We want the prod default, not a blank.
    process.env.STAGECRAFT_PUBLIC_URL = "";
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });

  it("ignores AUTH_URL entirely — we never want localhost leaking into artist sites", () => {
    // Earlier iteration fell back to AUTH_URL when STAGECRAFT_PUBLIC_URL was
    // unset, which made dev /create produce broken artist sites pointing at
    // http://localhost:3000. The hardcoded default IS the correct dev
    // behavior; AUTH_URL is irrelevant here.
    process.env.AUTH_URL = "http://localhost:3000";
    expect(getPublicPlatformUrl()).toBe("https://stagecraft.website");
  });
});
