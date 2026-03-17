import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerLinkTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_issue_links",
    {
      description: "Get all links (relations) for a Yandex Tracker issue",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const links = await client.getIssueLinks(issueKey);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(links, null, 2) },
        ],
      };
    },
  );
}
