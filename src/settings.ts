import dotenv from "dotenv";

// Load environment variables from .env if present. Doing this at module scope ensures
// configuration is available to every file importing loadConfig().
dotenv.config();

/**
 * ServiceConfig models the key settings required for the gateway to operate. Explicit
 * typing keeps future refactors deliberate because TypeScript will surface breaking changes.
 */
export interface ServiceConfig {
  corsOrigins: string[];
  downstreamServices: Array<{
    name: string;
    url: string;
  }>;
}

/**
 * loadConfig centralises environment parsing so we never scatter process.env lookups.
 * Each value is validated and defaulted with comments describing the rationale.
 */
export function loadConfig(): ServiceConfig {
  const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3000";
  const corsOrigins = rawOrigins.split(",").map((origin) => origin.trim());

  // Downstream service URLs can be provided as JSON; we default to mock services so the
  // gateway remains runnable in Phase 0.
  let downstreamServices: ServiceConfig["downstreamServices"] = [
    {
      name: "research",
      url: process.env.RESEARCH_GRAPHQL_URL ?? "http://localhost:7001/graphql",
    },
  ];

  if (process.env.SERVICE_LIST_JSON) {
    try {
      downstreamServices = JSON.parse(process.env.SERVICE_LIST_JSON);
    } catch (error) {
      console.warn("Failed to parse SERVICE_LIST_JSON; falling back to defaults", error);
    }
  }

  return {
    corsOrigins,
    downstreamServices,
  };
}

