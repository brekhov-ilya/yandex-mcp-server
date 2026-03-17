import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerChecklistTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_checklist",
    {
      description: "Get checklist items for a Yandex Tracker issue",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const items = await client.getChecklist(issueKey);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
      };
    },
  );
}
