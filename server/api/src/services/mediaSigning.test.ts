/**
 * Unit round-trip for the signed-URL scheme (task 4.3). No DB, no Express — pure function tests
 * against `signMediaUrl`/`verifyMediaSignature`, with `MEDIA_SIGNING_SECRET` set before the
 * module under test is imported (config reads `process.env` at import time).
 */
process.env.MEDIA_SIGNING_SECRET = "test-secret-a";
process.env.MEDIA_SIGNING_SECRET_PREVIOUS = "";
process.env.MEDIA_URL_TTL_SECONDS = "86400";
process.env.MEDIA_URL_BUCKET_SECONDS = "3600";

import { signMediaUrl, verifyMediaSignature } from "./mediaSigning.js";

const parseSigned = (signed: string) => {
  const [filename, query] = signed.split("?");
  const params = new URLSearchParams(query);
  return {
    filename: filename!,
    exp: Number(params.get("exp")),
    sig: params.get("sig")!,
  };
};

describe("mediaSigning", () => {
  it("round-trips: a URL signed now verifies", () => {
    const signed = signMediaUrl("a1b2c3d4.webp");
    const { filename, exp, sig } = parseSigned(signed);
    expect(verifyMediaSignature({ filename, exp, sig })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const { filename, exp, sig } = parseSigned(signMediaUrl("a1b2c3d4.webp"));
    const tampered = sig.slice(0, -1) + (sig.at(-1) === "0" ? "1" : "0");
    expect(verifyMediaSignature({ filename, exp, sig: tampered })).toBe(false);
  });

  it("rejects a filename swap using another file's signature", () => {
    const { exp, sig } = parseSigned(signMediaUrl("file-a.webp"));
    expect(verifyMediaSignature({ filename: "file-b.webp", exp, sig })).toBe(false);
  });

  it("rejects an expired signature", () => {
    const realNow = Date.now;
    let signed: string;
    try {
      // Sign as if it were the year 2000: the resulting `exp` (bucketed + TTL) is long past by
      // the time verification runs at the real "now" below.
      Date.now = () => new Date("2000-01-01T00:00:00.000Z").getTime();
      signed = signMediaUrl("a1b2c3d4.webp");
    } finally {
      Date.now = realNow;
    }
    const { filename, exp, sig } = parseSigned(signed);
    expect(verifyMediaSignature({ filename, exp, sig })).toBe(false);
  });

  it("two calls inside one bucket produce an identical string", () => {
    const first = signMediaUrl("stable.webp");
    const second = signMediaUrl("stable.webp");
    expect(first).toBe(second);
  });

  it("calls in different buckets differ", () => {
    const realNow = Date.now;
    try {
      Date.now = () => new Date("2026-01-01T00:00:00.000Z").getTime();
      const first = signMediaUrl("rotate.webp");
      Date.now = () => new Date("2026-01-01T02:00:00.000Z").getTime();
      const second = signMediaUrl("rotate.webp");
      expect(first).not.toBe(second);
    } finally {
      Date.now = realNow;
    }
  });

  it("verifies a signature made with the previous secret during rotation", async () => {
    jest.resetModules();
    process.env.MEDIA_SIGNING_SECRET = "secret-old";
    const oldModule = await import("./mediaSigning.js");
    const signedWithOld = oldModule.signMediaUrl("rotated.webp");
    const { filename, exp, sig } = parseSigned(signedWithOld);

    jest.resetModules();
    process.env.MEDIA_SIGNING_SECRET = "secret-new";
    process.env.MEDIA_SIGNING_SECRET_PREVIOUS = "secret-old";
    const newModule = await import("./mediaSigning.js");
    expect(newModule.verifyMediaSignature({ filename, exp, sig })).toBe(true);
  });
});
