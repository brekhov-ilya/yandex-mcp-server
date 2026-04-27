import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerUserTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    "find_user",
    {
      description:
        "Find Yandex Tracker users by display name (ФИО), login, or email substring. " +
        "Returns up to `limit` matches as [{login, display, email}]. " +
        "Use this BEFORE create_issue / update_issue when the user gave a Russian ФИО — " +
        "pass the resulting `login` as assignee. Do NOT use search_issues for user lookup.",
      inputSchema: z.object({
        query: z.string().describe("Substring of display name, login, or email (case-insensitive)"),
        limit: z.number().optional().default(10).describe("Max matches to return (default: 10)"),
      }),
    },
    async ({ query, limit }) => {
      const q = query.trim().toLocaleLowerCase();
      if (!q) {
        return { content: [{ type: "text" as const, text: "[]" }] };
      }
      const users = await client.getAllUsers();
      const matches = users
        .filter((u) => {
          const display = u.display?.toLocaleLowerCase() ?? "";
          const login = u.login?.toLocaleLowerCase() ?? "";
          const email = u.email?.toLocaleLowerCase() ?? "";
          return display.includes(q) || login.includes(q) || email.includes(q);
        })
        .slice(0, limit)
        .map((u) => ({
          login: u.login ?? u.id,
          display: u.display,
          email: u.email,
        }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(matches, null, 2) }],
      };
    },
  );
}
