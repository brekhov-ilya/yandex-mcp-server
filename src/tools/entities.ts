import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerEntityTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_entity",
    {
      description:
        "Get entity parameters (project, portfolio, etc.) from Yandex Tracker by type and ID",
      inputSchema: z.object({
        entityType: z
          .enum(["project", "portfolio"])
          .describe("Entity type: project or portfolio"),
        entityId: z.string().describe("Entity ID"),
      }),
    },
    async ({ entityType, entityId }) => {
      const entity = await client.getEntity(entityType, entityId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entity, null, 2) }],
      };
    },
  );
}
