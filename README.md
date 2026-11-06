# Book Rhino MCP

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [Book Rhino](https://github.com/leouofa/book-rhino), enabling AI assistants (Antigravity, Claude Desktop, Claude Code, and Cursor) to architect novels, build worlds and characters, manage creative taxonomies, upload reference imagery, orchestrate asynchronous Sidekiq AI pipelines, and export compiled Markdown manuscripts.

---

## Features

- 📚 **End-to-End Novel Pipeline**: Manage `books`, `chapters`, and `scenes` from seed concept through plot synthesis (`generate_book_plot`), sequential prose rendering (`render_chapter` / `render_book`), scene breakdown (`generate_chapter_scenes`), and cinematic scene rendering (`render_scene`).
- 🌍 **Deep Worldbuilding & Stylistics**: Full CRUD and AI prompt synthesis/iteration for `characters`, `locations`, `regions`, `writing_styles`, and prose sample `texts`, plus polymorphic management across all 8 creative taxonomies (`perspectives`, `archetypes`, `personality_traits`, `moral_alignments`, `narrative_structures`, `character_types`, `poetic_forms`, `cinematic_styles`).
- ⚡ **Smart Hybrid Sidekiq Polling**: Automatically polls `202 Accepted` Sidekiq operations (`ExecuteOperationJob`) with bounded backoff for fast single-item AI jobs (`wait: true` default) while keeping long full-book renders non-blocking (`wait: false` default) alongside `wait_for_operation`.
- 🕰️ **PaperTrail Version History & AI Merging**: Inspect version diffs (`list_versions`), restore prior snapshots (`revert_version`), or AI-merge historical prompts/plots (`merge_version`) across books, characters, locations, and writing styles.
- 🖼️ **Local File & Context-Window Ergonomics**: Upload local image files directly from disk (`file_path` ≤ 25 MB) for characters and locations, and export compiled Markdown manuscripts directly to local files (`output_path`) without flooding the LLM context window.
- 🔒 **Multi-Tier Safety Guardrails**: Supports `BOOK_RHINO_READ_ONLY=true` to block all mutating/AI tools, gates global platform prompt/tuning updates behind `BOOK_RHINO_ALLOW_ADMIN=true`, and intentionally omits credential minting/revocation (`api_tokens`) from the MCP surface.

---

## Installation & Quick Start

```bash
cd /Users/leonid/src/book-rhino-mcp
npm install
npm run build
```

### Generating a Book Rhino API Token

In your Book Rhino Rails application:
1. **Via Web UI**: Sign in and navigate to **API Tokens** (`/api_tokens`) to generate a `br_live_...` personal token.
2. **Via CLI Rake Task**:
   ```bash
   bin/rails "api_tokens:create[you@example.com,MCP Server]"
   ```

---

## Environment Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOOK_RHINO_URL` | **Yes** | — | Base URL of your Book Rhino instance (e.g. `http://localhost:3000` or `https://bookrhino.app`). |
| `BOOK_RHINO_API_KEY` | **Yes** | — | Personal Bearer token (`br_live_...`). |
| `BOOK_RHINO_READ_ONLY` | No | `false` | When `true` or `1`, rejects all create, update, delete, AI generation, and local file-write tools. |
| `BOOK_RHINO_ALLOW_ADMIN` | No | `false` | When `true` or `1`, enables `update_settings` (also requires an admin user token). |
| `BOOK_RHINO_TIMEOUT_MS` | No | `30000` | Per-request HTTP timeout in milliseconds. |
| `BOOK_RHINO_OPERATION_TIMEOUT_MS` | No | `90000` | Default maximum wait time (ms) when polling Sidekiq operations (`wait=true`). |
| `BOOK_RHINO_POLL_INTERVAL_MS` | No | `1500` | Initial polling interval (ms) for Sidekiq operations (backs off up to 4000ms). |

---

## MCP Client Configuration

### 1. Antigravity IDE / Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "book-rhino": {
      "command": "node",
      "args": ["/Users/leonid/src/book-rhino-mcp/dist/index.js"],
      "env": {
        "BOOK_RHINO_URL": "http://localhost:3000",
        "BOOK_RHINO_API_KEY": "br_live_your_token_here"
      }
    }
  }
}
```

### 2. Claude Code CLI

```bash
claude mcp add book-rhino \
  -e BOOK_RHINO_URL=http://localhost:3000 \
  -e BOOK_RHINO_API_KEY=br_live_your_token_here \
  -- node /Users/leonid/src/book-rhino-mcp/dist/index.js
```

---

## MCP Surface Overview

### Tools (74 Domain-Grouped Tools)

- **System & Operations (7)**: `check_health`, `get_me`, `get_settings`, `update_settings`, `list_operations`, `get_operation`, `wait_for_operation`
- **Books (9)**: `list_books`, `get_book`, `create_book`, `update_book`, `delete_book`, `get_book_manuscript`, `generate_book_plot`, `iterate_book_plot`, `render_book`
- **Chapters (7)**: `list_chapters`, `get_chapter`, `create_chapter`, `update_chapter`, `delete_chapter`, `render_chapter`, `generate_chapter_scenes`
- **Scenes (6)**: `list_scenes`, `get_scene`, `create_scene`, `update_scene`, `delete_scene`, `render_scene`
- **Characters (7)**: `list_characters`, `get_character`, `create_character`, `update_character`, `delete_character`, `generate_character_prompt`, `iterate_character_prompt`
- **Locations & Regions (12)**: `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location`, `generate_location_prompt`, `iterate_location_prompt`, `list_regions`, `get_region`, `create_region`, `update_region`, `delete_region`
- **Writing Styles & Sample Texts (12)**: `list_writing_styles`, `get_writing_style`, `create_writing_style`, `update_writing_style`, `delete_writing_style`, `generate_writing_style_prompt`, `iterate_writing_style_prompt`, `list_texts`, `get_text`, `create_text`, `update_text`, `delete_text`
- **Taxonomies (6)**: `list_all_taxonomies`, `list_taxonomy_items`, `get_taxonomy_item`, `create_taxonomy_item`, `update_taxonomy_item`, `delete_taxonomy_item`
- **PaperTrail Versions (3)**: `list_versions`, `revert_version`, `merge_version`
- **Images (5)**: `list_images`, `get_image`, `attach_image`, `update_image`, `delete_image`

### Resources (`bookrhino://`)

- `bookrhino://taxonomies` — Unified live dictionary of all 8 taxonomy collections + `writing_styles`.
- `bookrhino://books` — Paginated list of books and rendering status.
- `bookrhino://books/{id}` — Full book record with cast, locations, chapters, and scenes.
- `bookrhino://books/{id}/manuscript` — Compiled Markdown manuscript (`text/markdown`).
- `bookrhino://characters/{id}` — Detailed character sheet and resolved portrait URLs.
- `bookrhino://locations/{id}` — Detailed location profile and resolved image URLs.

### Guided Workflow Prompts

- `architect_book` — Worldbuild locations & cast -> synthesize character/location prompts -> create book -> generate plot & chapter outlines.
- `develop_character` — Build psychologically rich character profiles with taxonomy tags, portraits, and iterative AI prompt tuning.
- `produce_chapter` — Verify sequential `can_render` rules -> render chapter prose -> break into scenes -> render scenes with cinematic directions.
- `craft_writing_style` — Ingest prose sample texts -> synthesize structured JSON style prompt -> iterate stylistic cadence.

---

## Development & OpenAPI Type Sync

```bash
# Regenerate TypeScript schema definitions from Book Rhino's OpenAPI 3.1 spec
npm run generate:types

# Or point at a live Book Rhino server
OPENAPI_SPEC=http://localhost:3000/api/v1/openapi.json npm run generate:types

# Typecheck, test, and build
npm run typecheck
npm run test
npm run build
```
