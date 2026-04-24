import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export interface IssueToolsOptions {
  defaultAssignee?: string;
}

export function registerIssueTools(
  server: McpServer,
  client: TrackerClient,
  options: IssueToolsOptions = {},
): void {
  const { defaultAssignee } = options;
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
        "Search Yandex Tracker issues using query language (e.g. 'Queue: MYQUEUE AND Status: Open'). " +
        "By default filters by the assignee configured in TRACKER_USERNAME. " +
        "Pass `assignee` with a full name (e.g. 'Ivan Ivanov') to filter by someone else. " +
        "If the query already contains an Assignee clause, no default filter is added.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Search query in Yandex Tracker query language"),
        assignee: z
          .string()
          .optional()
          .describe(
            "Full name of the assignee (e.g. 'Ivan Ivanov'). Overrides TRACKER_USERNAME for this call. Ignored if `query` already contains 'Assignee:'.",
          ),
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
    async ({ query, assignee, page, perPage }) => {
      const clampedPerPage = Math.min(perPage, 100);
      const assigneeFilter = assignee ?? defaultAssignee;
      const queryHasAssignee = /\bassignee\s*:/i.test(query);
      const finalQuery =
        assigneeFilter && !queryHasAssignee
          ? `${query} AND Assignee: "${assigneeFilter.replace(/"/g, '\\"')}"`
          : query;
      const issues = await client.searchIssues(finalQuery, page, clampedPerPage);
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

  server.registerTool(
    "create_issue",
    {
      description:
        "Create a new issue in Yandex Tracker. Returns the created issue.",
      inputSchema: z.object({
        queue: z.string().describe("Queue key, e.g. MYQUEUE"),
        summary: z.string().describe("Issue title"),
        description: z.string().optional().describe("Issue description"),
        type: z.string().optional().describe("Issue type key, e.g. task, bug, story"),
        priority: z.string().optional().describe("Priority key, e.g. critical, major, normal, minor, trivial"),
        assignee: z.string().optional().describe("Assignee login"),
        parent: z.string().optional().describe("Parent issue key, e.g. QUEUE-1"),
        tags: z.array(z.string()).optional().describe("Tags"),
        followers: z.array(z.string()).optional().describe("Follower logins"),
      }),
    },
    async (params) => {
      const issue = await client.createIssue(params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_issue",
    {
      description:
        "Update an existing Yandex Tracker issue. Pass only the fields you want to change.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key to update, e.g. QUEUE-123"),
        summary: z.string().optional().describe("New issue title"),
        description: z.string().optional().describe("New description"),
        type: z.string().optional().describe("Issue type key, e.g. task, bug, story"),
        priority: z.string().optional().describe("Priority key, e.g. critical, major, normal, minor, trivial"),
        assignee: z.string().optional().describe("Assignee login"),
        parent: z.string().optional().describe("Parent issue key, e.g. QUEUE-1"),
        tags: z.array(z.string()).optional().describe("Tags (replaces existing)"),
        followers: z.array(z.string()).optional().describe("Follower logins (replaces existing)"),
      }),
    },
    async ({ issueKey, ...updateParams }) => {
      const issue = await client.updateIssue(issueKey, updateParams);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_transitions",
    {
      description:
        "Get available status transitions for a Yandex Tracker issue. Use this before transition_issue to find the correct transition ID.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const transitions = await client.getTransitions(issueKey);
      const summary = transitions.map((t) => ({
        id: t.id,
        display: t.display,
        toStatus: t.to?.display,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  server.registerTool(
    "transition_issue",
    {
      description:
        "Move a Yandex Tracker issue to a new status by executing a transition. Use get_transitions first to find available transition IDs. Some transitions require additional fields (e.g. resolution for 'close'). Use get_resolutions to find valid resolution keys.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
        transitionId: z.string().describe("Transition ID (get it from get_transitions)"),
        resolution: z.string().optional().describe("Resolution key (e.g. fixed, won'tFix, duplicate). Required for close transitions. Use get_resolutions to list available values."),
        comment: z.string().optional().describe("Comment to add when executing the transition"),
      }),
    },
    async ({ issueKey, transitionId, resolution, comment }) => {
      const fields: Record<string, unknown> = {};
      if (resolution) {
        fields.resolution = { key: resolution };
      }
      if (comment) {
        fields.comment = comment;
      }
      const result = await client.executeTransition(
        issueKey,
        transitionId,
        Object.keys(fields).length > 0 ? fields : undefined,
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
