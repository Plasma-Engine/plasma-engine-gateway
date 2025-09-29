import { createGatewayServer } from "./server.js";

/**
 * The entry point bootstraps the Apollo Gateway HTTP server.
 * Detailed comments are provided so another engineer can quickly
 * understand the control flow and extend it safely.
 */
async function main(): Promise<void> {
  // We wrap the server start in a try/catch block so startup failures are logged explicitly.
  try {
    const { app, httpServer } = await createGatewayServer();

    // Start listening once the Express app is fully configured.
    const port = Number(process.env.PORT ?? 4000);
    httpServer.listen(port, () => {
      console.log(`Plasma Engine Gateway listening on http://localhost:${port}`);
    });

    // Handle graceful shutdown on termination signals for container orchestration.
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}; shutting down gateway server.`);
      httpServer.close(() => process.exit(0));
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    // Expose the app object for testing frameworks if needed.
    if (process.env.NODE_ENV === "test") {
      // Vitest will reuse the Express instance through globalThis for integration tests.
      (globalThis as { app?: typeof app }).app = app;
    }
  } catch (error) {
    console.error("Failed to start Plasma Engine Gateway", error);
    process.exit(1);
  }
}

void main();

