import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export interface MetaToolsOptions {
  defaultQueue?: string;
}

export function registerMetaTools(
  server: McpServer,
  client: TrackerClient,
  options: MetaToolsOptions = {},
): void {
  const { defaultQueue } = options;
  server.registerTool(
    "get_statuses",
    {
      description: "Get all available issue statuses in Yandex Tracker",
      inputSchema: z.object({}),
    },
    async () => {
      const statuses = await client.getStatuses();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(statuses, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_issue_types",
    {
      description: "Get all available issue types in Yandex Tracker (task, bug, story, etc.)",
      inputSchema: z.object({}),
    },
    async () => {
      const types = await client.getIssueTypes();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(types, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_resolutions",
    {
      description: "Get all available issue resolutions in Yandex Tracker",
      inputSchema: z.object({}),
    },
    async () => {
      const resolutions = await client.getResolutions();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(resolutions, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_priorities",
    {
      description: "Get all available issue priorities in Yandex Tracker",
      inputSchema: z.object({}),
    },
    async () => {
      const priorities = await client.getPriorities();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(priorities, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_queues",
    {
      description: "Get list of available queues in Yandex Tracker",
      inputSchema: z.object({
        page: z.number().optional().default(1).describe("Page number (default: 1)"),
        perPage: z.number().optional().default(50).describe("Results per page (default: 50)"),
      }),
    },
    async ({ page, perPage }) => {
      const queues = await client.getQueues(page, perPage);
      const summary = queues.map((q) => ({
        key: q.key,
        name: q.name,
        description: q.description,
        lead: q.lead?.display,
        defaultType: q.defaultType?.display,
        defaultPriority: q.defaultPriority?.display,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_queue_local_fields",
    {
      description:
        "Get local (custom) fields for a specific queue in Yandex Tracker." +
        (defaultQueue
          ? ` Default queue is "${defaultQueue}" — when the user does not name a queue, OMIT queueKey and use the default. Do NOT ask the user to choose a queue.`
          : ""),
      inputSchema: z.object({
        queueKey: z.string().optional().describe(
          defaultQueue
            ? `Queue key, e.g. MYQUEUE. Optional — defaults to "${defaultQueue}". Pass only if user explicitly named another queue.`
            : "Queue key, e.g. MYQUEUE.",
        ),
      }),
    },
    async ({ queueKey }) => {
      const key = queueKey ?? defaultQueue;
      if (!key) {
        throw new Error("queueKey is required (set TRACKER_DEFAULT_QUEUE or pass `queueKey`)");
      }
      const fields = await client.getQueueLocalFields(key);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fields, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_global_fields",
    {
      description: "Get all global (system) fields available in Yandex Tracker",
      inputSchema: z.object({}),
    },
    async () => {
      const fields = await client.getGlobalFields();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fields, null, 2) }],
      };
    },
  );
}
