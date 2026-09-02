/**
 * Route-level test for `GET /uploads/*` signature verification (task 4.7). Mounts `uploadsRouter`
 * standalone (no DB, no full app) against a throwaway `UPLOAD_DIR`, so this exercises the real
 * Express pipeline — `UploadsController.verifySignature` → `express.static` — not just the pure
 * `mediaSigning` functions already covered by `mediaSigning.test.ts`.
 *
 * Every env var the modules under test read at import time (`UPLOAD_DIR`,
 * `MEDIA_URL_SIGNING_ENABLED`, `MEDIA_SIGNING_SECRET`) is set BEFORE the dynamic `import()`, and
 * `jest.resetModules()` runs between sections that need a different flag value — `config.ts`
 * reads `process.env` once at module load, so re-importing is the only way to flip it mid-suite.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";

const FILE_A = "file-a.webp";
const FILE_B = "file-b.webp";
const FILE_A_CONTENTS = "file-a-bytes";
const FILE_B_CONTENTS = "file-b-bytes";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-uploads-test-"));
  fs.writeFileSync(path.join(tmpDir, FILE_A), FILE_A_CONTENTS);
  fs.writeFileSync(path.join(tmpDir, FILE_B), FILE_B_CONTENTS);
  process.env.UPLOAD_DIR = tmpDir;
  process.env.MEDIA_SIGNING_SECRET = "route-test-secret";
  process.env.MEDIA_SIGNING_SECRET_PREVIOUS = "";
  process.env.MEDIA_URL_TTL_SECONDS = "86400";
  process.env.MEDIA_URL_BUCKET_SECONDS = "3600";
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const buildApp = async () => {
  jest.resetModules();
  const { uploadsRouter } = await import("./uploads.js");
  const app = express();
  app.use("/uploads", uploadsRouter);
  return app;
};

describe("GET /uploads/* — signing enabled", () => {
  let app: express.Express;
  let signMediaUrl: (filename: string) => string;

  beforeAll(async () => {
    process.env.MEDIA_URL_SIGNING_ENABLED = "true";
    jest.resetModules();
    ({ signMediaUrl } = await import("../services/mediaSigning.js"));
    app = await buildApp();
  });

  it("refuses a bare URL with no signature", async () => {
    const res = await request(app).get(`/uploads/${FILE_A}`);
    expect(res.status).toBe(403);
  });

  it("serves the file with a valid signature", async () => {
    const signed = signMediaUrl(FILE_A);
    const res = await request(app).get(`/uploads/${signed}`);
    expect(res.status).toBe(200);
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe(FILE_A_CONTENTS);
  });

  it("refuses a tampered signature", async () => {
    const signed = signMediaUrl(FILE_A);
    const [filename, query] = signed.split("?");
    const params = new URLSearchParams(query);
    const sig = params.get("sig")!;
    params.set("sig", sig.slice(0, -1) + (sig.at(-1) === "0" ? "1" : "0"));
    const res = await request(app).get(`/uploads/${filename}?${params.toString()}`);
    expect(res.status).toBe(403);
  });

  it("refuses a filename swapped for another file's signature", async () => {
    const signed = signMediaUrl(FILE_A);
    const query = signed.split("?")[1];
    const res = await request(app).get(`/uploads/${FILE_B}?${query}`);
    expect(res.status).toBe(403);
  });

  it("refuses an expired signature", async () => {
    const realNow = Date.now;
    let signed: string;
    try {
      Date.now = () => new Date("2000-01-01T00:00:00.000Z").getTime();
      signed = signMediaUrl(FILE_A);
    } finally {
      Date.now = realNow;
    }
    const res = await request(app).get(`/uploads/${signed}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /uploads/* — signing disabled (default)", () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.MEDIA_URL_SIGNING_ENABLED = "false";
    app = await buildApp();
  });

  it("serves a bare URL unchanged — byte-identical to pre-signing behaviour", async () => {
    const res = await request(app).get(`/uploads/${FILE_A}`);
    expect(res.status).toBe(200);
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe(FILE_A_CONTENTS);
  });
});
