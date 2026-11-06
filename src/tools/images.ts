import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prepareLocalImageUpload } from "../assets.js";
import { BookRhinoClient } from "../client.js";
import { IMAGE_OWNER_TYPES } from "../types.js";
import { errorResult, guardWrite, jsonResult, PaginationShape } from "./helpers.js";

const OwnerTypeEnum = z.enum(IMAGE_OWNER_TYPES);

export function registerImageTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_images
  server.tool(
    "list_images",
    "List attached images for a character or location with resolved ActiveStorage blob URLs.",
    {
      owner_type: OwnerTypeEnum.describe("Whether the images belong to a 'character' or 'location'."),
      owner_id: z.number().int().positive().describe("Character ID or Location ID."),
      ...PaginationShape,
    },
    async ({ owner_type, owner_id, ...params }) => {
      try {
        const res = await client.listImages(owner_type, owner_id, params);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list images for ${owner_type} ${owner_id}: ${err.message}`);
      }
    }
  );

  // 2. get_image
  server.tool(
    "get_image",
    "Retrieve metadata and resolved download URL for a single character or location image.",
    {
      owner_type: OwnerTypeEnum.describe("Image owner type ('character' or 'location')."),
      image_id: z.number().int().positive().describe("CharacterImage ID or LocationImage ID."),
    },
    async ({ owner_type, image_id }) => {
      try {
        const img = await client.getImage(owner_type, image_id);
        return jsonResult(img);
      } catch (err: any) {
        return errorResult(`Failed to get ${owner_type} image ${image_id}: ${err.message}`);
      }
    }
  );

  // 3. attach_image
  server.tool(
    "attach_image",
    "Upload and attach a portrait or concept image to a character or location. Provide exactly one source: local file_path (<= 25MB), remote public image_url, or image_base64.",
    {
      owner_type: OwnerTypeEnum.describe("Target owner type ('character' or 'location')."),
      owner_id: z.number().int().positive().describe("Character ID or Location ID."),
      title: z.string().optional().describe("Display title/caption for the image."),
      file_path: z
        .string()
        .optional()
        .describe("Local disk path to an image file (.png, .jpg, .jpeg, .gif, .webp, .svg) up to 25 MB."),
      image_url: z
        .string()
        .url()
        .optional()
        .describe("Public HTTP/HTTPS image URL for Book Rhino to download (private/loopback IPs are SSRF-blocked by the server; use file_path for local images)."),
      image_base64: z
        .string()
        .optional()
        .describe("Base64-encoded image string or data URI (data:image/png;base64,...)."),
      filename: z.string().optional().describe("Optional filename override when using image_base64."),
      content_type: z
        .string()
        .optional()
        .describe("Optional MIME type (e.g. image/png) when using raw image_base64."),
    },
    async ({
      owner_type,
      owner_id,
      title,
      file_path,
      image_url,
      image_base64,
      filename,
      content_type,
    }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      const providedCount = [file_path, image_url, image_base64].filter(Boolean).length;
      if (providedCount === 0) {
        return errorResult(
          "Provide an image source: one of file_path (local file), image_url (public HTTP/HTTPS URL), or image_base64."
        );
      }
      if (providedCount > 1) {
        return errorResult(
          "Provide only one image source at a time (file_path, image_url, OR image_base64)."
        );
      }

      try {
        if (file_path) {
          const local = await prepareLocalImageUpload(file_path);
          const created = await client.attachImage(owner_type, owner_id, {
            title,
            image_base64: local.image_base64,
            filename: filename || local.filename,
            content_type: content_type || local.content_type,
          });
          return jsonResult(created);
        }

        const created = await client.attachImage(owner_type, owner_id, {
          title,
          image_url,
          image_base64,
          filename,
          content_type,
        });
        return jsonResult(created);
      } catch (err: any) {
        return errorResult(`Failed to attach image to ${owner_type} ${owner_id}: ${err.message}`);
      }
    }
  );

  // 4. update_image
  server.tool(
    "update_image",
    "Update the display title of an attached character or location image.",
    {
      owner_type: OwnerTypeEnum.describe("Image owner type ('character' or 'location')."),
      image_id: z.number().int().positive().describe("CharacterImage ID or LocationImage ID."),
      title: z.string().min(1).describe("New image title."),
    },
    async ({ owner_type, image_id, title }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const updated = await client.updateImage(owner_type, image_id, { title });
        return jsonResult(updated);
      } catch (err: any) {
        return errorResult(`Failed to update ${owner_type} image ${image_id}: ${err.message}`);
      }
    }
  );

  // 5. delete_image
  server.tool(
    "delete_image",
    "Delete an attached character or location image.",
    {
      owner_type: OwnerTypeEnum.describe("Image owner type ('character' or 'location')."),
      image_id: z.number().int().positive().describe("CharacterImage ID or LocationImage ID."),
    },
    async ({ owner_type, image_id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteImage(owner_type, image_id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete ${owner_type} image ${image_id}: ${err.message}`);
      }
    }
  );
}
