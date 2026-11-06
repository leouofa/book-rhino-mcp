import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

export function registerCharacterTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_characters
  server.tool(
    "list_characters",
    "List and search characters alphabetically, optionally filtered by name query or book_id.",
    {
      q: z.string().optional().describe("Case-insensitive search by character name."),
      book_id: z.number().int().positive().optional().describe("Filter supporting characters linked to a Book ID."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listCharacters(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list characters: ${err.message}`);
      }
    }
  );

  // 2. get_character
  server.tool(
    "get_character",
    "Retrieve full character sheet including biography, psychology, synthesized AI prompt, taxonomy tags, linked locations, and portrait images.",
    {
      id: z.number().int().positive().describe("Character ID."),
    },
    async ({ id }) => {
      try {
        const character = await client.getCharacter(id);
        return jsonResult(character);
      } catch (err: any) {
        return errorResult(`Failed to get character ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_character
  server.tool(
    "create_character",
    "Create a new character profile with biographical attributes and taxonomy associations (character_types, moral_alignments, personality_traits, archetypes, locations).",
    {
      name: z.string().min(1).describe("Character's full name (required)."),
      gender: z.string().optional().describe("Gender identity."),
      age: z.number().int().positive().optional().describe("Age in years (positive integer)."),
      ethnicity: z.string().optional().describe("Ethnicity or heritage."),
      nationality: z.string().optional().describe("Nationality or faction allegiance."),
      appearance: z.string().optional().describe("Physical appearance, build, clothing, and distinguishing features."),
      health: z.string().optional().describe("Physical and mental health notes."),
      fears: z.string().optional().describe("Core fears and vulnerabilities."),
      desires: z.string().optional().describe("Core ambitions, goals, and desires."),
      backstory: z.string().optional().describe("Formative history and backstory."),
      skills: z.string().optional().describe("Abilities, training, and competencies."),
      values: z.string().optional().describe("Core beliefs, code of ethics, and values."),
      prompt: z.string().optional().describe("Explicit character prompt (normally generated via generate_character_prompt)."),
      character_type_ids: z.array(z.number().int().positive()).optional().describe("Linked CharacterType IDs."),
      moral_alignment_ids: z.array(z.number().int().positive()).optional().describe("Linked MoralAlignment IDs."),
      personality_trait_ids: z.array(z.number().int().positive()).optional().describe("Linked PersonalityTrait IDs."),
      archetype_ids: z.array(z.number().int().positive()).optional().describe("Linked Archetype IDs."),
      location_ids: z.array(z.number().int().positive()).optional().describe("Associated Location IDs."),
    },
    async (args) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const character = await client.createCharacter(args);
        return jsonResult(character);
      } catch (err: any) {
        return errorResult(`Failed to create character: ${err.message}`);
      }
    }
  );

  // 4. update_character
  server.tool(
    "update_character",
    "Update an existing character's attributes, prompt, or taxonomy associations.",
    {
      id: z.number().int().positive().describe("Character ID."),
      name: z.string().min(1).optional().describe("Character's name."),
      gender: z.string().optional().describe("Gender identity."),
      age: z.number().int().positive().optional().describe("Age (positive integer)."),
      ethnicity: z.string().optional().describe("Ethnicity."),
      nationality: z.string().optional().describe("Nationality."),
      appearance: z.string().optional().describe("Physical appearance."),
      health: z.string().optional().describe("Health notes."),
      fears: z.string().optional().describe("Fears."),
      desires: z.string().optional().describe("Desires."),
      backstory: z.string().optional().describe("Backstory."),
      skills: z.string().optional().describe("Skills."),
      values: z.string().optional().describe("Values."),
      prompt: z.string().optional().describe("Character prompt."),
      character_type_ids: z.array(z.number().int().positive()).optional().describe("CharacterType IDs."),
      moral_alignment_ids: z.array(z.number().int().positive()).optional().describe("MoralAlignment IDs."),
      personality_trait_ids: z.array(z.number().int().positive()).optional().describe("PersonalityTrait IDs."),
      archetype_ids: z.array(z.number().int().positive()).optional().describe("Archetype IDs."),
      location_ids: z.array(z.number().int().positive()).optional().describe("Location IDs."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const character = await client.updateCharacter(id, body);
        return jsonResult(character);
      } catch (err: any) {
        return errorResult(`Failed to update character ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_character
  server.tool(
    "delete_character",
    "Delete a character and their attached portrait images.",
    {
      id: z.number().int().positive().describe("Character ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteCharacter(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete character ${id}: ${err.message}`);
      }
    }
  );

  // 6. generate_character_prompt
  server.tool(
    "generate_character_prompt",
    "Synthesize a rich AI narrative prompt from the character's attributes and taxonomy tags (GenerateCharacterPromptJob).",
    {
      id: z.number().int().positive().describe("Character ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.generateCharacterPrompt(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to generate prompt for character ${id}: ${err.message}`);
      }
    }
  );

  // 7. iterate_character_prompt
  server.tool(
    "iterate_character_prompt",
    "Refine an existing character prompt via natural-language feedback instructions (IterateOnCharacterPromptJob).",
    {
      id: z.number().int().positive().describe("Character ID."),
      message: z.string().min(1).describe("Feedback or revision instructions for refining the character prompt."),
      ...waitShape(true),
    },
    async ({ id, message, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.iterateCharacterPrompt(id, message, {
          wait,
          timeoutMs: timeout_ms,
        });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to iterate prompt for character ${id}: ${err.message}`);
      }
    }
  );
}
