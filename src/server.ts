import { ApolloGateway } from "@apollo/gateway";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import cors from "cors";
import express, { Express } from "express";
import http from "node:http";
import { buildServiceList } from "./serviceList.js";
import { loadConfig } from "./settings.js";

/**
 * createGatewayServer wires together the Apollo Gateway, Express HTTP server,
 * and supporting middleware (CORS, JSON parsing). Extensive inline comments are
 * provided to help future maintainers extend authentication, logging, or routing.
 */
export async function createGatewayServer(): Promise<{
  app: Express;
  httpServer: http.Server;
}> {
  // Load strongly-typed configuration so misconfigured environments fail fast.
  const config = loadConfig();

  // ApolloGateway composes schemas from downstream GraphQL services.
  const gateway = new ApolloGateway({
    // In production we will swap this for managed federation or supergraph schema delivery.
    serviceList: buildServiceList(config),
  });

  // ApolloServer wraps the gateway for request execution.
  const apollo = new ApolloServer({
    gateway,
    // Disable subscriptions until downstream services expose them.
    subscriptions: false,
  });

  // Ensure the server is started before attaching middleware to Express.
  await apollo.start();

  // Express app handles HTTP-specific concerns such as headers, auth, and health checks.
  const app = express();

  // Apply CORS rules defined in configuration for cross-origin access from dashboards.
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );

  // Health check endpoint keeps load balancers happy during rolling deploys.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "plasma-engine-gateway" });
  });

  // Attach Apollo middleware to the Express app at /graphql.
  app.use("/graphql", express.json(), expressMiddleware(apollo));

  // Wrap Express inside a Node HTTP server so we can register shutdown hooks.
  const httpServer = http.createServer(app);

  return { app, httpServer };
}

