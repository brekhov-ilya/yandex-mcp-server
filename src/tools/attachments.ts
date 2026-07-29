import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrackerClient } from "../tracker-client.js";

export function registerAttachmentTools(
  server: McpServer,
  client: TrackerClient,
): void {
  server.registerTool(
    "get_attachments",
    {
      description:
        "Get attachment metadata (name, size, MIME type, id) for a Yandex Tracker issue",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
      }),
    },
    async ({ issueKey }) => {
      const attachments = await client.getAttachments(issueKey);
      const metadata = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        mimetype: a.mimetype,
        size: a.size,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(metadata, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "upload_attachment",
    {
      description:
        "Upload a file (e.g. a photo) as an attachment to a Yandex Tracker issue. Returns the attachment id plus a ready-to-use markdown snippet. To show the file inline in an issue description or comment, include the returned `markdown` in update_issue's `description` or create_comment's/update_comment's `text`. To just attach it (shown as a file, not inline), pass the returned `id` in create_comment's/update_comment's `attachmentIds`.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
        filename: z.string().describe("File name, e.g. screenshot.png"),
        mimeType: z
          .string()
          .describe("MIME type of the file, e.g. image/png, image/jpeg"),
        data: z.string().describe("Base64-encoded file content"),
      }),
    },
    async ({ issueKey, filename, mimeType, data }) => {
      const attachment = await client.uploadAttachment(issueKey, {
        filename,
        mimeType,
        data,
      });
      const result = {
        id: attachment.id,
        name: attachment.name,
        mimetype: attachment.mimetype,
        size: attachment.size,
        content: attachment.content,
        thumbnail: attachment.thumbnail,
        markdown: `![${attachment.name}](${attachment.content})`,
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "download_attachment",
    {
      description:
        "Download an attachment from a Yandex Tracker issue. Returns base64-encoded content. For images, returns an image content block.",
      inputSchema: z.object({
        issueKey: z.string().describe("Issue key, e.g. QUEUE-123"),
        attachmentId: z
          .string()
          .describe("Attachment ID (get it from get_attachments)"),
      }),
    },
    async ({ issueKey, attachmentId }) => {
      const result = await client.downloadAttachment(issueKey, attachmentId);

      if (result.mimeType.startsWith("image/")) {
        return {
          content: [
            {
              type: "image" as const,
              data: result.content,
              mimeType: result.mimeType,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `MIME type: ${result.mimeType}\nBase64 content:\n${result.content}`,
          },
        ],
      };
    },
  );
}
