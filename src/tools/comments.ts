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

  server.registerTool(
    "create_comment",
    {
      description:
        "Create a comment on a Yandex Tracker issue. Supports summonees (user logins or full names — resolved automatically) and attachmentIds.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
        text: z.string().min(1).describe("Comment text (markdown supported)"),
        summonees: z
          .array(z.string())
          .optional()
          .describe("Logins or full names of users to summon (notify)"),
        attachmentIds: z
          .array(z.string())
          .optional()
          .describe("IDs of pre-uploaded attachments to attach to the comment"),
      }),
    },
    async ({ issueKey, text, summonees, attachmentIds }) => {
      const resolvedSummonees = summonees
        ? await Promise.all(summonees.map((s) => client.resolveUserLogin(s)))
        : undefined;
      const comment = await client.createComment(issueKey, {
        text,
        summonees: resolvedSummonees,
        attachmentIds,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(comment, null, 2) },
        ],
      };
    },
  );
}
