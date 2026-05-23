/**
 * EstateIQ API entrypoint.
 *
 * Phase 0 only ships a health-check HTTP server proving that workspace
 * packages resolve correctly. The MCP server, tool registry, and routing
 * layer land in Phase 1 (Task 1.2).
 */

import { createServer } from "node:http";
import { describeStack } from "@estate-iq/analysis-engine";
import { SHARED_PACKAGE_NAME } from "@estate-iq/shared";

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer((req, res) => {
  if (req.url === "/health") {
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  console.info(`[estate-iq-api] listening on http://localhost:${PORT}`);
});
