import type TestAgent from "supertest/lib/agent";

declare global {
  var __SERVER__: Server;
  var api: TestAgent;
}
