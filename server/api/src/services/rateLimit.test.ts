/**
 * Rate limiter montado en una app de Express descartable (SEC-03, D3). Esto es lo que hace que
 * apagarlo en `docker-compose.e2e.yml` (`RATE_LIMIT_ENABLED=false`) no cueste cobertura: el
 * comportamiento real se prueba acá, aislado del stack de e2e.
 */
import express from "express";
import request from "supertest";

const buildApp = async () => {
  jest.resetModules();
  const { makeLimiter } = await import("../middlewares/rateLimit");
  const app = express();
  app.get("/probe", makeLimiter({ windowMs: 60_000, max: 2, name: "probe-test" }), (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  return app;
};

describe("rateLimit / enabled (default)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, RATE_LIMIT_ENABLED: "true" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("allows requests within the window", async () => {
    const app = await buildApp();
    const first = await request(app).get("/probe");
    const second = await request(app).get("/probe");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("rejects the request past the configured max with 429 and RATE_LIMITED", async () => {
    const app = await buildApp();
    await request(app).get("/probe");
    await request(app).get("/probe");
    const third = await request(app).get("/probe");
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ success: false, errorCode: "RATE_LIMITED" });
  });
});

describe("rateLimit / disabled via RATE_LIMIT_ENABLED=false", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: "development", RATE_LIMIT_ENABLED: "false" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("never trips, no matter how many requests are made", async () => {
    const app = await buildApp();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/probe");
      expect(res.status).toBe(200);
    }
  });
});
