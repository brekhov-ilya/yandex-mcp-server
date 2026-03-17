#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TrackerClient } from "./tracker-client.js";
import { resolveToken } from "./auth.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerAttachmentTools } from "./tools/attachments.js";
import { registerLinkTools } from "./tools/links.js";

const DEFAULT_CLIENT_ID = "f5d1542673544cb7aab999dbcf98fe2e";

interface CliArgs {
  orgId?: string;
  cloudOrgId?: string;
  clientId: string;
  forceAuth: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let orgId: string | undefined;
  let cloudOrgId: string | undefined;
  let clientId: string = DEFAULT_CLIENT_ID;
  let forceAuth = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-id" && args[i + 1]) {
      orgId = args[++i];
    } else if (args[i] === "--cloud-org-id" && args[i + 1]) {
      cloudOrgId = args[++i];
    } else if (args[i] === "--client-id" && args[i + 1]) {
      clientId = args[++i];
    } else if (args[i] === "--auth") {
      forceAuth = true;
    }
  }

  return { orgId, cloudOrgId, clientId, forceAuth };
}

async function main(): Promise<void> {
  const { orgId, cloudOrgId, clientId, forceAuth } = parseArgs();

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

  const token = await resolveToken({ clientId, forceAuth });

  const client = new TrackerClient({ token, orgId, cloudOrgId });

  const server = new McpServer({
    name: "yandex-tracker-mcp",
    version: "1.0.0",
  });

  registerIssueTools(server, client);
  registerCommentTools(server, client);
  registerAttachmentTools(server, client);
  registerLinkTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
