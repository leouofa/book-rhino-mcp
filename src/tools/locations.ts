import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

export function registerLocationTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_locations
  server.tool(
    "list_locations",
    "List and search worldbuilding locations, optionally filtered by query, region_id, or book_id.",
    {
      q: z.string().optional().describe("Case-insensitive search across location name and description."),
      region_id: z.number().int().positive().optional().describe("Filter by parent Region ID."),
      book_id: z.number().int().positive().optional().describe("Filter locations linked to a Book ID."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listLocations(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list locations: ${err.message}`);
      }
    }
  );

  // 2. get_location
  server.tool(
    "get_location",
    "Retrieve full location details including sensory attributes, region, AI prompt, linked character IDs, and reference images.",
    {
      id: z.number().int().positive().describe("Location ID."),
    },
    async ({ id }) => {
      try {
        const location = await client.getLocation(id);
        return jsonResult(location);
      } catch (err: any) {
        return errorResult(`Failed to get location ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_location
  server.tool(
    "create_location",
    "Create a new location with atmospheric/sensory attributes. Both name (unique) and description are required.",
    {
      name: z.string().min(1).describe("Unique location name (required)."),
      description: z.string().min(1).describe("Core overview description of the location (required)."),
      region_id: z.number().int().positive().optional().describe("Optional parent Region ID."),
      lighting: z.string().optional().describe("Lighting conditions (e.g. flickering neon, dappled canopy sunlight)."),
      time: z.string().optional().describe("Typical time of day, season, or era."),
      noise_level: z.string().optional().describe("Acoustic ambiance and noise level."),
      comfort: z.string().optional().describe("Physical comfort, temperature, and shelter."),
      aesthetics: z.string().optional().describe("Architectural style, materials, colors, and visual texture."),
      accessibility: z.string().optional().describe("Entrances, terrain, security, and ease of access."),
      personalization: z.string().optional().describe("Lived-in details, props, and personal artifacts."),
      prompt: z.string().optional().describe("Explicit location prompt (normally synthesized via generate_location_prompt)."),
      character_ids: z.array(z.number().int().positive()).optional().describe("Associated Character IDs."),
    },
    async (args) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const location = await client.createLocation(args);
        return jsonResult(location);
      } catch (err: any) {
        return errorResult(`Failed to create location: ${err.message}`);
      }
    }
  );

  // 4. update_location
  server.tool(
    "update_location",
    "Update an existing location's sensory attributes, region, prompt, or associated characters.",
    {
      id: z.number().int().positive().describe("Location ID."),
      name: z.string().min(1).optional().describe("Unique location name."),
      description: z.string().min(1).optional().describe("Location description."),
      region_id: z.number().int().positive().optional().describe("Parent Region ID."),
      lighting: z.string().optional().describe("Lighting conditions."),
      time: z.string().optional().describe("Time/era."),
      noise_level: z.string().optional().describe("Noise level."),
      comfort: z.string().optional().describe("Comfort notes."),
      aesthetics: z.string().optional().describe("Visual aesthetics."),
      accessibility: z.string().optional().describe("Accessibility notes."),
      personalization: z.string().optional().describe("Personalization details."),
      prompt: z.string().optional().describe("Location prompt."),
      character_ids: z.array(z.number().int().positive()).optional().describe("Associated Character IDs."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const location = await client.updateLocation(id, body);
        return jsonResult(location);
      } catch (err: any) {
        return errorResult(`Failed to update location ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_location
  server.tool(
    "delete_location",
    "Delete a location and its attached reference images.",
    {
      id: z.number().int().positive().describe("Location ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteLocation(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete location ${id}: ${err.message}`);
      }
    }
  );

  // 6. generate_location_prompt
  server.tool(
    "generate_location_prompt",
    "Synthesize an atmospheric AI worldbuilding prompt for a location (GenerateLocationPromptJob).",
    {
      id: z.number().int().positive().describe("Location ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.generateLocationPrompt(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to generate prompt for location ${id}: ${err.message}`);
      }
    }
  );

  // 7. iterate_location_prompt
  server.tool(
    "iterate_location_prompt",
    "Refine a location's AI prompt with natural-language instructions (IterateOnLocationPromptJob).",
    {
      id: z.number().int().positive().describe("Location ID."),
      message: z.string().min(1).describe("Revision instructions for the location prompt."),
      ...waitShape(true),
    },
    async ({ id, message, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.iterateLocationPrompt(id, message, {
          wait,
          timeoutMs: timeout_ms,
        });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to iterate prompt for location ${id}: ${err.message}`);
      }
    }
  );

  // 8. list_regions
  server.tool(
    "list_regions",
    "List geographic or worldbuilding regions with optional search query or country filter.",
    {
      q: z.string().optional().describe("Case-insensitive search across region name, city, and country."),
      country: z.string().optional().describe("Exact country/realm filter."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listRegions(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list regions: ${err.message}`);
      }
    }
  );

  // 9. get_region
  server.tool(
    "get_region",
    "Retrieve a single region by ID.",
    {
      id: z.number().int().positive().describe("Region ID."),
    },
    async ({ id }) => {
      try {
        const region = await client.getRegion(id);
        return jsonResult(region);
      } catch (err: any) {
        return errorResult(`Failed to get region ${id}: ${err.message}`);
      }
    }
  );

  // 10. create_region
  server.tool(
    "create_region",
    "Create a new geographic or worldbuilding region to group locations.",
    {
      name: z.string().min(1).describe("Region name."),
      city: z.string().optional().describe("City or settlement."),
      state: z.string().optional().describe("State, province, or sector."),
      country: z.string().optional().describe("Country, nation, or realm."),
      description: z.string().optional().describe("Overview description of the region."),
    },
    async (args) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const region = await client.createRegion(args);
        return jsonResult(region);
      } catch (err: any) {
        return errorResult(`Failed to create region: ${err.message}`);
      }
    }
  );

  // 11. update_region
  server.tool(
    "update_region",
    "Update an existing region's name, city, state, country, or description.",
    {
      id: z.number().int().positive().describe("Region ID."),
      name: z.string().min(1).optional().describe("Region name."),
      city: z.string().optional().describe("City."),
      state: z.string().optional().describe("State or province."),
      country: z.string().optional().describe("Country or realm."),
      description: z.string().optional().describe("Description."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const region = await client.updateRegion(id, body);
        return jsonResult(region);
      } catch (err: any) {
        return errorResult(`Failed to update region ${id}: ${err.message}`);
      }
    }
  );

  // 12. delete_region
  server.tool(
    "delete_region",
    "Delete a region by ID.",
    {
      id: z.number().int().positive().describe("Region ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteRegion(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete region ${id}: ${err.message}`);
      }
    }
  );
}
