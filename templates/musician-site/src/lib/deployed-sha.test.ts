import { describe, expect, it } from "vitest";

import { parseDeployedSha } from "./deployed-sha";

describe("parseDeployedSha", () => {
  it("parses the standard meta tag emitted by Next.js metadata.other", () => {
    const html = `<meta name="stagecraft-deployed-sha" content="abc123def456"/>`;
    expect(parseDeployedSha(html)).toBe("abc123def456");
  });

  it("parses when content comes before name", () => {
    const html = `<meta content="xyz789" name="stagecraft-deployed-sha"/>`;
    expect(parseDeployedSha(html)).toBe("xyz789");
  });

  it("works with single quotes", () => {
    const html = `<meta name='stagecraft-deployed-sha' content='abc123'/>`;
    expect(parseDeployedSha(html)).toBe("abc123");
  });

  it("matches case-insensitively on the tag name", () => {
    const html = `<META Name="stagecraft-deployed-sha" CONTENT="abc"/>`;
    expect(parseDeployedSha(html)).toBe("abc");
  });

  it("returns null when the meta tag is absent", () => {
    const html = `<meta name="viewport" content="width=device-width"/>`;
    expect(parseDeployedSha(html)).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(parseDeployedSha("")).toBeNull();
  });

  it("finds the tag in a realistic-looking <head>", () => {
    const html = `
      <!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <title>Foo</title>
        <meta name="viewport" content="width=device-width"/>
        <meta name="stagecraft-deployed-sha" content="9097584abc"/>
        <link rel="icon" href="/favicon.ico"/>
      </head></html>
    `;
    expect(parseDeployedSha(html)).toBe("9097584abc");
  });

  it("doesn't match a meta tag with a different name even if it contains 'stagecraft'", () => {
    const html = `<meta name="stagecraft-publish-id" content="should-not-match"/>`;
    expect(parseDeployedSha(html)).toBeNull();
  });
});
