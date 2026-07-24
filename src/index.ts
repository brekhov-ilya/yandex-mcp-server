#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { TrackerClient } from "./tracker-client.js";
import { resolveToken } from "./auth.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerAttachmentTools } from "./tools/attachments.js";
import { registerLinkTools } from "./tools/links.js";
import { registerMetaTools } from "./tools/meta.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerUserTools } from "./tools/users.js";

const DEFAULT_CLIENT_ID = "74e48aa0cc7c492b8a296c5d17f2cfd7";
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
        process.stderr.write(
          "Error: --port must be a valid port number (1-65535).\n",
        );
        process.exit(1);
      }
    } else if (args[i] === "--host" && args[i + 1]) {
      host = args[++i];
    } else if (args[i] === "--token" && args[i + 1]) {
      token = args[++i];
    }
  }

  return {
    orgId,
    cloudOrgId,
    clientId,
    forceAuth,
    transport,
    port,
    host,
    token,
  };
}

interface ServerConfig {
  defaultAssignee?: string;
  defaultQueue?: string;
  defaultProject?: string;
}

function createConfiguredServer(
  client: TrackerClient,
  config: ServerConfig = {},
): McpServer {
  const server = new McpServer({
    name: "yandex-tracker-mcp",
    version: "1.0.0",
  });

  registerIssueTools(server, client, {
    defaultAssignee: config.defaultAssignee,
    defaultQueue: config.defaultQueue,
    defaultProject: config.defaultProject,
  });
  registerCommentTools(server, client);
  registerAttachmentTools(server, client);
  registerLinkTools(server, client);
  registerMetaTools(server, client, { defaultQueue: config.defaultQueue });
  registerEntityTools(server, client);
  registerChecklistTools(server, client);
  registerUserTools(server, client);

  return server;
}

interface HttpServerDefaults {
  orgId?: string;
  cloudOrgId?: string;
  defaultQueue?: string;
  defaultProject?: string;
}

const ASSIGNEE_CACHE_TTL_MS = 10 * 60 * 1000;
const assigneeCache = new Map<string, { display: string | undefined; expiresAt: number }>();

async function resolveDefaultAssignee(
  client: TrackerClient,
  token: string,
): Promise<string | undefined> {
  const cached = assigneeCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.display;
  }

  let display: string | undefined;
  try {
    const myself = await client.getMyself();
    display = myself.display || myself.login;
  } catch {
    display = undefined;
  }

  assigneeCache.set(token, { display, expiresAt: Date.now() + ASSIGNEE_CACHE_TTL_MS });
  return display;
}

function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers["authorization"];
  if (!auth || Array.isArray(auth)) return undefined;
  const match = /^(?:OAuth|Bearer)\s+(.+)$/i.exec(auth);
  return match?.[1];
}

function extractOrgHeaders(req: IncomingMessage): {
  orgId?: string;
  cloudOrgId?: string;
} {
  const orgId = req.headers["x-org-id"];
  const cloudOrgId = req.headers["x-cloud-org-id"];
  return {
    orgId: typeof orgId === "string" ? orgId : undefined,
    cloudOrgId: typeof cloudOrgId === "string" ? cloudOrgId : undefined,
  };
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf-8"),
        );
        resolve(body);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJsonError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
  );
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  defaults: HttpServerDefaults,
): Promise<void> {
  const parsedUrl = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  if (parsedUrl.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const method = req.method?.toUpperCase();
  if (method !== "POST" && method !== "GET" && method !== "DELETE") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    sendJsonError(
      res,
      401,
      -32001,
      'Missing or invalid Authorization header (expected "OAuth <token>" or "Bearer <token>" with your personal Yandex Tracker OAuth token).',
    );
    return;
  }

  const headerOrg = extractOrgHeaders(req);
  const orgId = headerOrg.orgId ?? defaults.orgId;
  const cloudOrgId = headerOrg.cloudOrgId ?? defaults.cloudOrgId;

  if (orgId && cloudOrgId) {
    sendJsonError(
      res,
      400,
      -32000,
      "Specify either X-Org-Id or X-Cloud-Org-Id, not both.",
    );
    return;
  }
  if (!orgId && !cloudOrgId) {
    sendJsonError(
      res,
      400,
      -32000,
      "Missing organization: pass an X-Org-Id or X-Cloud-Org-Id header, or configure TRACKER_ORG_ID / TRACKER_CLOUD_ORG_ID on the server.",
    );
    return;
  }

  let body: unknown;
  if (method === "POST") {
    try {
      body = await parseJsonBody(req);
    } catch {
      sendJsonError(res, 400, -32700, "Parse error");
      return;
    }
  }

  const client = new TrackerClient({ token, orgId, cloudOrgId });
  const defaultAssignee = await resolveDefaultAssignee(client, token);

  const server = createConfiguredServer(client, {
    defaultAssignee,
    defaultQueue: defaults.defaultQueue,
    defaultProject: defaults.defaultProject,
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close().catch(() => undefined);
    server.close().catch(() => undefined);
  });

  await server.connect(transport);

  if (method === "POST") {
    await transport.handleRequest(req, res, body);
  } else {
    await transport.handleRequest(req, res);
  }
}

async function startHttpServer(
  port: number,
  host: string,
  defaults: HttpServerDefaults,
): Promise<void> {
  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      handleMcpRequest(req, res, defaults).catch((err: unknown) => {
        process.stderr.write(
          `Unhandled error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        if (!res.headersSent) {
          sendJsonError(res, 500, -32603, "Internal server error");
        }
      });
    },
  );

  httpServer.listen(port, host, () => {
    process.stderr.write(
      `MCP HTTP server listening on http://${host}:${port}/mcp\n`,
    );
    process.stderr.write(
      "Each request must carry its own \"Authorization: OAuth <token>\" header with a personal Yandex Tracker OAuth token.\n",
    );
  });
}

async function main(): Promise<void> {
  const {
    orgId: cliOrgId,
    cloudOrgId: cliCloudOrgId,
    clientId,
    forceAuth,
    transport,
    port,
    host,
    token: cliToken,
  } = parseArgs();

  const orgId = cliOrgId ?? process.env.TRACKER_ORG_ID;
  const cloudOrgId = cliCloudOrgId ?? process.env.TRACKER_CLOUD_ORG_ID;

  if (orgId && cloudOrgId) {
    process.stderr.write(
      "Error: Specify either --org-id / TRACKER_ORG_ID or --cloud-org-id / TRACKER_CLOUD_ORG_ID, not both.\n",
    );
    process.exit(1);
  }

  if (forceAuth) {
    await resolveToken({ clientId, forceAuth: true });
    process.stderr.write(
      `Token is stored in ~/.config/yandex-tracker-mcp/token.json. You can now start the server without --auth.\n`,
    );
    return;
  }

  const defaultQueue = process.env.TRACKER_DEFAULT_QUEUE?.trim() || undefined;
  const defaultProject = process.env.TRACKER_DEFAULT_PROJECT?.trim() || undefined;
  if (defaultProject && !/^\d+$/.test(defaultProject)) {
    process.stderr.write(
      `Warning: TRACKER_DEFAULT_PROJECT="${defaultProject}" is not numeric — it will be used in TQL search filters but skipped in create_issue/update_issue (Tracker v3 expects numeric shortId).\n`,
    );
  }

  if (transport === "http") {
    // HTTP mode is multi-tenant: each request supplies its own OAuth token
    // (and optionally its own org) via headers. orgId/cloudOrgId here are
    // only used as a server-wide fallback when a request omits them.
    await startHttpServer(port, host, { orgId, cloudOrgId, defaultQueue, defaultProject });
    return;
  }

  if (!orgId && !cloudOrgId) {
    process.stderr.write(
      "Error: You must specify either --org-id <value> / TRACKER_ORG_ID or --cloud-org-id <value> / TRACKER_CLOUD_ORG_ID.\n",
    );
    process.exit(1);
  }

  const token = cliToken ?? (await resolveToken({ clientId, forceAuth: false }));
  const client = new TrackerClient({ token, orgId, cloudOrgId });

  const defaultAssignee = process.env.TRACKER_USERNAME?.trim() || undefined;
  const serverConfig: ServerConfig = { defaultAssignee, defaultQueue, defaultProject };

  const server = createConfiguredServer(client, serverConfig);
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
