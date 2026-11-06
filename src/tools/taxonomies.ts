import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { TAXONOMY_TYPES } from "../types.js";
import { errorResult, guardWrite, jsonResult, PaginationShape } from "./helpers.js";

const TaxonomyEnum = z.enum(TAXONOMY_TYPES);

const TAXONOMY_FIELD_GUIDE = [
  "perspectives: { name, narrator?, pronouns?, effect?, example? }",
  "archetypes: { name, traits?, examples? }",
  "personality_traits: { name, description? }",
  "moral_alignments: { name (required), description (required), examples?: string[] }",
  "narrative_structures: { name (required), description?, parts?: Record<string, unknown> }",
  "character_types: { name, definition?, purpose?, example? }",
  "poetic_forms: { name (required), description?, meter?, rhyme_scheme?, guidelines?, example? }",
  "cinematic_styles: { name (required), aesthetic_tags (required), description?, lighting?, example? }",
].join("; ");

export function registerTaxonomyTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_all_taxonomies
  server.tool(
    "list_all_taxonomies",
    "Fetch all 8 creative taxonomy dictionaries (perspectives, archetypes, personality_traits, moral_alignments, narrative_structures, character_types, poetic_forms, cinematic_styles) plus writing_styles in one parallel snapshot. Call this before creating books or characters to resolve valid IDs.",
    {},
    async () => {
      try {
        const all = await client.fetchAllTaxonomiesAndStyles();
        return jsonResult(all);
      } catch (err: any) {
        return errorResult(`Failed to fetch taxonomy dictionaries: ${err.message}`);
      }
    }
  );

  // 2. list_taxonomy_items
  server.tool(
    "list_taxonomy_items",
    "List or search records within one of Book Rhino's 8 creative taxonomy collections.",
    {
      taxonomy: TaxonomyEnum.describe("Target taxonomy collection."),
      q: z.string().optional().describe("Case-insensitive search by name."),
      ...PaginationShape,
    },
    async ({ taxonomy, ...params }) => {
      try {
        const res = await client.listTaxonomy(taxonomy, params);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list ${taxonomy}: ${err.message}`);
      }
    }
  );

  // 3. get_taxonomy_item
  server.tool(
    "get_taxonomy_item",
    "Retrieve a single taxonomy item by collection type and ID.",
    {
      taxonomy: TaxonomyEnum.describe("Target taxonomy collection."),
      id: z.number().int().positive().describe("Taxonomy item ID."),
    },
    async ({ taxonomy, id }) => {
      try {
        const item = await client.getTaxonomy(taxonomy, id);
        return jsonResult(item);
      } catch (err: any) {
        return errorResult(`Failed to get ${taxonomy}/${id}: ${err.message}`);
      }
    }
  );

  // 4. create_taxonomy_item
  server.tool(
    "create_taxonomy_item",
    `Create a new record in one of the 8 taxonomy collections. Allowed attributes by taxonomy: ${TAXONOMY_FIELD_GUIDE}.`,
    {
      taxonomy: TaxonomyEnum.describe("Target taxonomy collection."),
      attributes: z
        .record(z.unknown())
        .describe(`Key-value attributes for the selected taxonomy (${TAXONOMY_FIELD_GUIDE}).`),
    },
    async ({ taxonomy, attributes }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const created = await client.createTaxonomy(taxonomy, attributes);
        return jsonResult(created);
      } catch (err: any) {
        return errorResult(`Failed to create item in ${taxonomy}: ${err.message}`);
      }
    }
  );

  // 5. update_taxonomy_item
  server.tool(
    "update_taxonomy_item",
    `Update an existing taxonomy record. Allowed attributes by taxonomy: ${TAXONOMY_FIELD_GUIDE}.`,
    {
      taxonomy: TaxonomyEnum.describe("Target taxonomy collection."),
      id: z.number().int().positive().describe("Taxonomy item ID."),
      attributes: z.record(z.unknown()).describe("Attributes to update."),
    },
    async ({ taxonomy, id, attributes }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const updated = await client.updateTaxonomy(taxonomy, id, attributes);
        return jsonResult(updated);
      } catch (err: any) {
        return errorResult(`Failed to update ${taxonomy}/${id}: ${err.message}`);
      }
    }
  );

  // 6. delete_taxonomy_item
  server.tool(
    "delete_taxonomy_item",
    "Delete a taxonomy item by collection type and ID.",
    {
      taxonomy: TaxonomyEnum.describe("Target taxonomy collection."),
      id: z.number().int().positive().describe("Taxonomy item ID."),
    },
    async ({ taxonomy, id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteTaxonomy(taxonomy, id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete ${taxonomy}/${id}: ${err.message}`);
      }
    }
  );
}
