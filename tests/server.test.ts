import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import http from "node:http";
import { createGatewayServer } from "../src/server.js";

describe("Gateway server", () => {
  let app: Express;
  let server: http.Server;

  beforeAll(async () => {
    const bootstrap = await createGatewayServer();
    app = bootstrap.app;
    server = bootstrap.httpServer;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("exposes an HTTP server instance", () => {
    expect(app).toBeDefined();
    expect(server.listening).toBe(false);
  });
});

