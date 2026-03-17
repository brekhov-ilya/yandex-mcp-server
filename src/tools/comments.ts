import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerCommentTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_comments",
    {
      description: "Get all comments for a Yandex Tracker issue",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const comments = await client.getComments(issueKey);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(comments, null, 2) },
        ],
      };
    },
  );
}
