/**
 * EstateIQ API entrypoint.
 *
 * Phase 1 ships:
 *   - GET  /health                  liveness probe
 *   - GET  /health/db               DB connectivity probe (counts properties)
 *   - GET  /mcp/tools               list registered MCP tools
 *   - POST /mcp/tools/:name         invoke a tool with a JSON body
 *
 * The same tool registry is also exposed over MCP-native stdio (see
 * apps/api/src/mcp-stdio.ts) so a tool registered once is callable from
 * either transport.
 */

import "./env.js";
import { createServer } from "node:http";
import { describeStack } from "@estate-iq/analysis-engine";
import { SHARED_PACKAGE_NAME } from "@estate-iq/shared";
import { prisma } from "./db/client.js";
import { handleMcpHttpRequest } from "./mcp/transport/http.js";
import { logger } from "./mcp/logger.js";
// Importing the mcp barrel triggers tool self-registration.
import "./mcp/index.js";

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer(async (req, res) => {
  const url = req.url ?? "";

  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "estate-iq-api",
        sharedPackage: SHARED_PACKAGE_NAME,
        analysisEngine: describeStack(),
      }),
    );
    return;
  }

  if (url === "/health/db") {
    try {
      const propertyCount = await prisma.property.count();
      const userCount = await prisma.user.count();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          database: "connected",
          counts: { properties: propertyCount, users: userCount },
        }),
      );
    } catch (error) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          database: "unreachable",
          message: error instanceof Error ? error.message : "unknown error",
        }),
      );
    }
    return;
  }

  if (await handleMcpHttpRequest(req, res)) return;

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  logger.info("api.listening", { port: PORT });
});

const shutdown = async (signal: string) => {
  logger.info("api.shutdown", { signal });
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
