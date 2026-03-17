import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerIssueTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_issue",
    {
      description:
        "Get a single Yandex Tracker issue by its key (e.g. QUEUE-123)",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const issue = await client.getIssue(issueKey);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "search_issues",
    {
      description:
        "Search Yandex Tracker issues using query language (e.g. 'Queue: MYQUEUE AND Status: Open')",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Search query in Yandex Tracker query language"),
        page: z
          .number()
          .optional()
          .default(1)
          .describe("Page number (default: 1)"),
        perPage: z
          .number()
          .optional()
          .default(50)
          .describe("Results per page (default: 50, max: 100)"),
      }),
    },
    async ({ query, page, perPage }) => {
      const clampedPerPage = Math.min(perPage, 100);
      const issues = await client.searchIssues(query, page, clampedPerPage);
      const summary = issues.map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        status: issue.status?.display,
        type: issue.type?.display,
        priority: issue.priority?.display,
        assignee: issue.assignee?.display,
        updatedAt: issue.updatedAt,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary, null, 2) },
        ],
      };
    },
  );
}
