import type { components, paths } from "./generated/openapi.js";

export type OpenApiPaths = paths;
export type OpenApiSchemas = components["schemas"];

export type PaginationMeta = Required<OpenApiSchemas["MetaPagination"]>;

export interface ApiEnvelope<T> {
  data: T;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error?: ApiErrorDetail | string;
}

export const TAXONOMY_TYPES = [
  "perspectives",
  "archetypes",
  "personality_traits",
  "moral_alignments",
  "narrative_structures",
  "character_types",
  "poetic_forms",
  "cinematic_styles",
] as const;

export type TaxonomyType = (typeof TAXONOMY_TYPES)[number];

export const VERSIONABLE_RESOURCE_TYPES = [
  "books",
  "characters",
  "locations",
  "writing_styles",
] as const;

export type VersionableResourceType = (typeof VERSIONABLE_RESOURCE_TYPES)[number];

export const IMAGE_OWNER_TYPES = ["character", "location"] as const;
export type ImageOwnerType = (typeof IMAGE_OWNER_TYPES)[number];

export type OperationStatus = NonNullable<
  NonNullable<OpenApiSchemas["OperationResponse"]["data"]>["status"]
>;

export interface OperationRecord {
  id: number;
  user_id?: number | null;
  resource_type?: string | null;
  resource_id?: number | null;
  operation_type: string;
  job_class: string;
  status: OperationStatus;
  metadata?: Record<string, unknown>;
  error_class?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AsyncAcceptedData<TResource = Record<string, unknown>> {
  operation: OperationRecord;
  resource?: TResource;
}

export interface AsyncExecutionResult<TResource = unknown> {
  status: OperationStatus;
  waited: boolean;
  timed_out: boolean;
  operation: OperationRecord;
  resource?: TResource;
  hint?: string;
}

export interface WaitOptions {
  wait?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface IdNameRef {
  id: number;
  name: string;
}

export interface ImageBlobMetadata {
  url: string;
  filename: string;
  content_type: string;
  byte_size: number;
  created_at?: string | null;
}

export interface ImageRecord {
  id: number;
  title: string;
  character_id?: number;
  location_id?: number;
  image: ImageBlobMetadata | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SceneRecord {
  id: number;
  chapter_id: number;
  number: number;
  outline?: string | null;
  content?: string | null;
  summary?: string | null;
  rendering: boolean;
  can_render: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChapterRecord {
  id: number;
  book_id: number;
  number: number;
  name: string;
  outline?: string | null;
  content?: string | null;
  summary?: string | null;
  scene_count?: number | null;
  rendering: boolean;
  can_render: boolean;
  word_count: number;
  scenes_count?: number;
  scenes?: SceneRecord[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BookRecord {
  id: number;
  title: string;
  moral?: string | null;
  plot?: string | null;
  chapter_count?: number | null;
  pages?: number | null;
  pending: boolean;
  rendering: boolean;
  writing_style_id: number;
  perspective_id?: number | null;
  narrative_structure_id?: number | null;
  poetic_form_id?: number | null;
  cinematic_style_id?: number | null;
  protagonist_id?: number | null;
  antagonist_ids?: number[];
  character_ids?: number[];
  location_ids?: number[];
  actual_chapters_count?: number;
  writing_style?: IdNameRef | null;
  perspective?: IdNameRef | null;
  narrative_structure?: IdNameRef | null;
  poetic_form?: IdNameRef | null;
  cinematic_style?: IdNameRef | null;
  protagonist?: IdNameRef | null;
  antagonists?: IdNameRef[];
  characters?: IdNameRef[];
  locations?: IdNameRef[];
  chapters?: ChapterRecord[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ManuscriptData {
  id: number;
  title: string;
  total_chapters: number;
  total_word_count: number;
  markdown: string;
  chapters: ChapterRecord[];
}

export interface CharacterRecord {
  id: number;
  name: string;
  gender?: string | null;
  age?: number | null;
  ethnicity?: string | null;
  nationality?: string | null;
  appearance?: string | null;
  health?: string | null;
  fears?: string | null;
  desires?: string | null;
  backstory?: string | null;
  skills?: string | null;
  values?: string | null;
  prompt?: string | null;
  pending: boolean;
  character_type_ids?: number[];
  moral_alignment_ids?: number[];
  personality_trait_ids?: number[];
  archetype_ids?: number[];
  images_count?: number;
  character_types?: IdNameRef[];
  moral_alignments?: IdNameRef[];
  personality_traits?: IdNameRef[];
  archetypes?: IdNameRef[];
  locations?: IdNameRef[];
  images?: ImageRecord[];
  book_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RegionRecord {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  locations_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LocationRecord {
  id: number;
  name: string;
  region_id?: number | null;
  description?: string | null;
  lighting?: string | null;
  time?: string | null;
  noise_level?: string | null;
  comfort?: string | null;
  aesthetics?: string | null;
  accessibility?: string | null;
  personalization?: string | null;
  prompt?: string | null;
  pending: boolean;
  region_name?: string | null;
  images_count?: number;
  region?: RegionRecord | null;
  images?: ImageRecord[];
  character_ids?: number[];
  book_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TextRecord {
  id: number;
  writing_style_id: number;
  name: string;
  corpus?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface WritingStyleRecord {
  id: number;
  name: string;
  prompt?: Record<string, unknown> | string | null;
  pending: boolean;
  texts_count?: number;
  texts?: TextRecord[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaxonomyRecord {
  id: number;
  name: string;
  type: string;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface VersionRecord {
  id: number;
  event: string;
  item_type: string;
  item_id: number;
  whodunnit?: string | null;
  created_at?: string | null;
  changes: Record<string, unknown>;
}

export interface SettingRecord {
  id: number;
  prompts?: Record<string, unknown> | null;
  tunings?: Record<string, unknown> | null;
  publish_start_time?: string | null;
  publish_end_time?: string | null;
  character_image_prompt?: string | null;
  character_pose_prompt?: string | null;
  scene_background_prompt?: string | null;
  location_background_prompt?: string | null;
  within_publish_window: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type BookInput = OpenApiSchemas["BookInput"];
export type ChapterInput = OpenApiSchemas["ChapterInput"];
export type SceneInput = OpenApiSchemas["SceneInput"];
export type CharacterInput = OpenApiSchemas["CharacterInput"];
export type LocationInput = OpenApiSchemas["LocationInput"];
export type RegionInput = OpenApiSchemas["RegionInput"];
export type TextInput = OpenApiSchemas["TextInput"];
