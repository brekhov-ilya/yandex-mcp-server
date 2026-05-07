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

  server.registerTool(
    "create_issue_link",
    {
      description:
        "Create a link (relation) between two Yandex Tracker issues. Relationship types: 'relates', 'depends on', 'is dependent by', 'duplicates', 'is duplicated by', 'is subtask for', 'is parent task for', 'is epic of', 'has epic'.",
      inputSchema: z.object({
        issueKey: z.string().describe("Source issue key, e.g. QUEUE-123"),
        relationship: z
          .enum([
            "relates",
            "is dependent by",
            "depends on",
            "is subtask for",
            "is parent task for",
            "duplicates",
            "is duplicated by",
            "is epic of",
            "has epic",
          ])
          .describe("Link type"),
        targetIssueKey: z
          .string()
          .describe("Target issue key to link to, e.g. QUEUE-456"),
      }),
    },
    async ({ issueKey, relationship, targetIssueKey }) => {
      const link = await client.createIssueLink(issueKey, {
        relationship,
        issue: targetIssueKey,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(link, null, 2) },
        ],
      };
    },
  );
}
