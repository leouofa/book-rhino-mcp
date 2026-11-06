import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "./client.js";

function summarizeIdNames(items?: unknown[]): string {
  if (!items || items.length === 0) return "(none yet)";
  return items
    .map((item: any) => `${item.id}: ${item.name}`)
    .join(", ");
}

export function registerPrompts(server: McpServer, client: BookRhinoClient): void {
  // 1. architect_book
  server.prompt(
    "architect_book",
    "End-to-end novel architecture workflow: worldbuilding locations & cast characters -> AI prompt synthesis -> book creation -> plot & chapter outline generation.",
    {
      concept: z.string().describe("Core story premise, genre, tone, and thematic direction."),
      chapter_count: z.string().optional().describe("Target number of chapters (e.g. '12')."),
      target_pages: z.string().optional().describe("Target page count (e.g. '240')."),
    },
    async (args) => {
      let taxonomyBlock = "(Call `list_all_taxonomies` first to inspect available IDs.)";
      try {
        const snapshot = await client.fetchAllTaxonomiesAndStyles();
        taxonomyBlock = [
          `- writing_styles: ${summarizeIdNames(snapshot.writing_styles)}`,
          `- perspectives: ${summarizeIdNames(snapshot.perspectives)}`,
          `- narrative_structures: ${summarizeIdNames(snapshot.narrative_structures)}`,
          `- poetic_forms: ${summarizeIdNames(snapshot.poetic_forms)}`,
          `- cinematic_styles: ${summarizeIdNames(snapshot.cinematic_styles)}`,
          `- character_types: ${summarizeIdNames(snapshot.character_types)}`,
          `- archetypes: ${summarizeIdNames(snapshot.archetypes)}`,
          `- moral_alignments: ${summarizeIdNames(snapshot.moral_alignments)}`,
          `- personality_traits: ${summarizeIdNames(snapshot.personality_traits)}`,
        ].join("\n");
      } catch {
        // Fallback note retained if server isn't reachable yet
      }

      const text = `You are a master story architect working inside Book Rhino.
Design and build a complete book project from the following concept:

### Story Concept
${args.concept}
${args.chapter_count ? `Target Chapter Count: ${args.chapter_count}\n` : ""}${args.target_pages ? `Target Pages: ${args.target_pages}\n` : ""}
### Live Book Rhino Taxonomies & Writing Styles
${taxonomyBlock}

### Required Execution Pipeline & Domain Rules
1. **Select or Create Taxonomies & Writing Style**:
   - Every book REQUIRES \`writing_style_id\`, \`perspective_id\`, and \`narrative_structure_id\`. Reuse matching IDs above or create missing ones with \`create_writing_style\` / \`create_taxonomy_item\`.
2. **Worldbuild Regions & Locations First**:
   - Create key regions (\`create_region\`) and atmospheric locations (\`create_location\` — requires unique \`name\` and \`description\` plus sensory attributes).
   - Run \`generate_location_prompt\` on each location so its synthesized AI prompt is ready before book plot generation.
3. **Create Cast Characters & Generate Their Prompts**:
   - Create characters (\`create_character\`) with rich backstory/desires/fears and taxonomy IDs (\`archetype_ids\`, \`moral_alignment_ids\`, \`personality_trait_ids\`, \`character_type_ids\`).
   - Run \`generate_character_prompt\` on each character so \`Book#as_json\` receives rich character prompts.
4. **Create the Book (Enforce Disjoint Cast Roles)**:
   - Call \`create_book\`. **CRITICAL RULE**: \`protagonist_id\`, \`antagonist_ids\`, and supporting \`character_ids\` MUST be strictly mutually exclusive (never place the protagonist or any antagonist inside \`character_ids\`).
5. **Generate Plot & Chapter Outlines**:
   - Call \`generate_book_plot\` (with \`wait: true\`) to synthesize the master plot and chapter outlines, then review with \`get_book\` and refine if needed via \`iterate_book_plot\`.`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );

  // 2. develop_character
  server.prompt(
    "develop_character",
    "Build or deepen a Book Rhino character sheet with psychological depth, taxonomy tags, optional portrait attachment, and iterative AI prompt synthesis.",
    {
      name_or_id: z.string().describe("Existing numeric Character ID to refine, or the name of a new character."),
      concept_or_notes: z.string().describe("Character concept, role in the story, contradictions, or revision notes."),
    },
    async (args) => {
      let existingCharacterText = "";
      const numericId = Number(args.name_or_id);
      if (Number.isInteger(numericId) && numericId > 0) {
        try {
          const existing = await client.getCharacter(numericId);
          existingCharacterText = `\n### Current Character State (ID ${numericId})\n${JSON.stringify(existing, null, 2)}\n`;
        } catch {
          // Ignore if ID doesn't exist
        }
      }

      let charTaxonomies = "(Use `list_all_taxonomies` to inspect character taxonomy IDs.)";
      try {
        const [types, archetypes, alignments, traits] = await Promise.all([
          client.listTaxonomy("character_types", { per_page: 100 }),
          client.listTaxonomy("archetypes", { per_page: 100 }),
          client.listTaxonomy("moral_alignments", { per_page: 100 }),
          client.listTaxonomy("personality_traits", { per_page: 100 }),
        ]);
        charTaxonomies = [
          `- character_types: ${summarizeIdNames(types.data)}`,
          `- archetypes: ${summarizeIdNames(archetypes.data)}`,
          `- moral_alignments: ${summarizeIdNames(alignments.data)}`,
          `- personality_traits: ${summarizeIdNames(traits.data)}`,
        ].join("\n");
      } catch {
        // Fallback retained
      }

      const text = `You are a character development specialist for Book Rhino.
Create or evolve the character "${args.name_or_id}" using these notes:
"${args.concept_or_notes}"
${existingCharacterText}
### Available Character Taxonomies
${charTaxonomies}

### Workflow Instructions
1. Populate concrete, vivid details across \`appearance\`, \`fears\`, \`desires\`, \`backstory\`, \`skills\`, \`values\`, and \`health\`, linking appropriate taxonomy IDs.
2. Call \`create_character\` (or \`update_character\` if updating an existing ID).
3. If a portrait file or URL is provided, attach it with \`attach_image\` (\`owner_type: "character"\`).
4. Synthesize the narrative prompt with \`generate_character_prompt\`, and if polishing nuance, follow up with \`iterate_character_prompt\` (or compare historical versions with \`list_versions\` / \`merge_version\`).`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );

  // 3. produce_chapter
  server.prompt(
    "produce_chapter",
    "Execute Book Rhino's sequential chapter prose rendering, scene breakdown, and cinematic scene rendering pipeline.",
    {
      book_id: z.string().describe("Numeric Book ID."),
      chapter_number: z.string().describe("1-based chapter number to render and break into scenes."),
      scene_count: z.string().optional().describe("Desired number of scenes for scene breakdown (e.g. '4')."),
      cinematic_notes: z.string().optional().describe("Optional framing, shot_type, or stylistic direction for rendering scenes."),
    },
    async (args) => {
      let bookContext = `(Use \`get_book\` with id=${args.book_id} to inspect chapters.)`;
      const bookId = Number(args.book_id);
      if (Number.isInteger(bookId) && bookId > 0) {
        try {
          const book = await client.getBook(bookId);
          const chapterSummaries = (book.chapters || []).map((c) => ({
            id: c.id,
            number: c.number,
            name: c.name,
            can_render: c.can_render,
            rendered: Boolean(c.content && c.content.trim().length > 0),
            word_count: c.word_count,
            scene_count: c.scene_count,
            existing_scenes: c.scenes?.length ?? 0,
          }));
          bookContext = `Book: "${book.title}" (ID ${book.id})\nChapters:\n${JSON.stringify(chapterSummaries, null, 2)}`;
        } catch {
          // Keep fallback
        }
      }

      const text = `You are a literary & cinematic chapter producer working in Book Rhino.
Produce Chapter ${args.chapter_number} of Book ${args.book_id}.
${args.scene_count ? `Target Scene Count: ${args.scene_count}\n` : ""}${args.cinematic_notes ? `Cinematic Notes: ${args.cinematic_notes}\n` : ""}
### Current Book & Chapter Status
${bookContext}

### Pipeline Rules
1. **Sequential Rendering Prerequisite**: A chapter can only be rendered (\`can_render: true\`) once all preceding chapters have non-empty \`content\`. If an earlier chapter is unrendered, render chapters in ascending numerical order first via \`render_chapter\`.
2. **Render Chapter Prose**: Call \`render_chapter\` on the target chapter (\`wait: true\`) to generate both \`content\` and \`summary\`.
3. **Scene Breakdown Prerequisite**: \`generate_chapter_scenes\` requires \`content\` to be present AND \`scene_count > 0\`. If \`scene_count\` is null/0 (or needs updating), call \`update_chapter\` first to set \`scene_count\` (e.g. ${args.scene_count || "3-5"}), then call \`generate_chapter_scenes\`.
4. **Render Individual Scenes**: Inspect the generated scenes via \`get_chapter\` or \`list_scenes\`, then call \`render_scene\` on each scene (passing optional \`shot_type\` and \`style\` aligned with any cinematic notes).`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );

  // 4. craft_writing_style
  server.prompt(
    "craft_writing_style",
    "Create a custom Book Rhino WritingStyle from reference prose excerpts and synthesize/iterate its structured JSON style prompt.",
    {
      style_name: z.string().describe("Name for the writing style (e.g. 'Lyrical Cyberpunk Noir')."),
      sample_excerpts: z
        .string()
        .optional()
        .describe("One or more reference prose passages to ingest as Text corpora."),
      refinement_goal: z
        .string()
        .optional()
        .describe("Specific stylistic qualities (cadence, diction, metaphor density, POV distance) to emphasize."),
    },
    async (args) => {
      const text = `You are a literary stylistics analyst configuring a WritingStyle in Book Rhino.

### Target Style
Name: "${args.style_name}"
${args.refinement_goal ? `Stylistic Goal: ${args.refinement_goal}\n` : ""}${args.sample_excerpts ? `\n### Reference Prose Excerpts\n${args.sample_excerpts}\n` : ""}
### Instructions
1. Check \`list_writing_styles\` (with \`q: "${args.style_name}"\`) to see if this style already exists, or create it via \`create_writing_style\`.
2. Attach each reference prose passage using \`create_text\` (\`writing_style_id\`, \`name\`, \`corpus\`). If no raw excerpts were supplied, draft 1-2 representative exemplar passages matching "${args.style_name}" and attach them via \`create_text\` so the style analyzer has concrete prose to study.
3. Run \`generate_writing_style_prompt\` (\`wait: true\`) to synthesize the structured JSON style prompt.
4. If additional tuning is needed${args.refinement_goal ? ` for "${args.refinement_goal}"` : ""}, run \`iterate_writing_style_prompt\` with targeted feedback instructions.`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );
}
