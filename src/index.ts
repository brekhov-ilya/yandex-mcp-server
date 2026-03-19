#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { TrackerClient } from "./tracker-client.js";
import { resolveToken } from "./auth.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerAttachmentTools } from "./tools/attachments.js";
import { registerLinkTools } from "./tools/links.js";
import { registerMetaTools } from "./tools/meta.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerChecklistTools } from "./tools/checklists.js";

const DEFAULT_CLIENT_ID = "f5d1542673544cb7aab999dbcf98fe2e";
const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_HTTP_HOST = "0.0.0.0";

interface CliArgs {
  orgId?: string;
  cloudOrgId?: string;
  clientId: string;
  forceAuth: boolean;
  transport: "stdio" | "http";
  port: number;
  host: string;
  token?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let orgId: string | undefined;
  let cloudOrgId: string | undefined;
  let clientId: string = DEFAULT_CLIENT_ID;
  let forceAuth = false;
  let transport: "stdio" | "http" = "stdio";
  let port: number = DEFAULT_HTTP_PORT;
  let host: string = DEFAULT_HTTP_HOST;
  let token: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-id" && args[i + 1]) {
      orgId = args[++i];
    } else if (args[i] === "--cloud-org-id" && args[i + 1]) {
      cloudOrgId = args[++i];
    } else if (args[i] === "--client-id" && args[i + 1]) {
      clientId = args[++i];
    } else if (args[i] === "--auth") {
      forceAuth = true;
    } else if (args[i] === "--transport" && args[i + 1]) {
      const value = args[++i];
      if (value !== "stdio" && value !== "http") {
        process.stderr.write(
          `Error: --transport must be "stdio" or "http", got "${value}".\n`,
        );
        process.exit(1);
      }
      transport = value;
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[++i], 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        process.stderr.write("Error: --port must be a valid port number (1-65535).\n");
        process.exit(1);
      }
    } else if (args[i] === "--host" && args[i + 1]) {
      host = args[++i];
    } else if (args[i] === "--token" && args[i + 1]) {
      token = args[++i];
    }
  }

  return { orgId, cloudOrgId, clientId, forceAuth, transport, port, host, token };
}

function createConfiguredServer(client: TrackerClient): McpServer {
  const server = new McpServer({
    name: "yandex-tracker-mcp",
    version: "1.0.0",
  });

  registerIssueTools(server, client);
  registerCommentTools(server, client);
  registerAttachmentTools(server, client);
  registerLinkTools(server, client);
  registerMetaTools(server, client);
  registerEntityTools(server, client);
  registerChecklistTools(server, client);

  return server;
}

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        resolve(body);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function extractTokenFromHeader(req: IncomingMessage): string | undefined {
  const auth = req.headers["authorization"];
  if (!auth) return undefined;
  const match = /^(?:OAuth|Bearer)\s+(.+)$/i.exec(auth);
  return match?.[1];
}

function extractOrgHeaders(req: IncomingMessage): { orgId?: string; cloudOrgId?: string } {
  const orgId = req.headers["x-org-id"] as string | undefined;
  const cloudOrgId = req.headers["x-cloud-org-id"] as string | undefined;
  return { orgId, cloudOrgId };
}

function sendJsonError(res: ServerResponse, status: number, code: number, message: string): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

async function startHttpServer(port: number, host: string): Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const method = req.method?.toUpperCase();

    if (method === "POST") {
      let body: unknown;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJsonError(res, 400, -32700, "Parse error");
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, body);
        return;
      }

      if (!sessionId && isInitializeRequest(body)) {
        const token = extractTokenFromHeader(req);
        if (!token) {
          sendJsonError(res, 401, -32001, "Missing Authorization header. Use: Authorization: OAuth <token> or Bearer <token>");
          return;
        }

        const { orgId, cloudOrgId } = extractOrgHeaders(req);
        if (!orgId && !cloudOrgId) {
          sendJsonError(res, 400, -32002, "Missing organization header. Provide x-org-id or x-cloud-org-id");
          return;
        }
        if (orgId && cloudOrgId) {
          sendJsonError(res, 400, -32002, "Provide either x-org-id or x-cloud-org-id, not both");
          return;
        }

        const client = new TrackerClient({ token, orgId, cloudOrgId });

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            transports.set(newSessionId, transport);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            transports.delete(sid);
          }
        };

        const server = createConfiguredServer(client);
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      sendJsonError(res, 400, -32000, "Bad request: no valid session ID or not an initialization request");
    } else if (method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        sendJsonError(res, 400, -32000, "Bad request: missing or invalid session ID");
        return;
      }
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    } else if (method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        sendJsonError(res, 400, -32000, "Bad request: missing or invalid session ID");
        return;
      }
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  });

  httpServer.listen(port, host, () => {
    process.stderr.write(`MCP HTTP server listening on http://${host}:${port}/mcp\n`);
  });
}

async function main(): Promise<void> {
  const { orgId, cloudOrgId, clientId, forceAuth, transport, port, host, token: cliToken } = parseArgs();

  if (transport === "http") {
    await startHttpServer(port, host);
    return;
  }

  // stdio mode — требуем org-id и токен при запуске
  if (orgId && cloudOrgId) {
    process.stderr.write(
      "Error: Specify either --org-id or --cloud-org-id, not both.\n",
    );
    process.exit(1);
  }

  if (!orgId && !cloudOrgId) {
    process.stderr.write(
      "Error: You must specify either --org-id <value> or --cloud-org-id <value>.\n",
    );
    process.exit(1);
  }

  let token: string;
  if (cliToken) {
    token = cliToken;
  } else {
    token = await resolveToken({ clientId, forceAuth });
  }

  const client = new TrackerClient({ token, orgId, cloudOrgId });
  const server = createConfiguredServer(client);
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
