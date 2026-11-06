import { BookRhinoConfig } from "./config.js";
import {
  ApiEnvelope,
  ApiErrorEnvelope,
  AsyncAcceptedData,
  AsyncExecutionResult,
  BookInput,
  BookRecord,
  ChapterInput,
  ChapterRecord,
  CharacterInput,
  CharacterRecord,
  ImageOwnerType,
  ImageRecord,
  LocationInput,
  LocationRecord,
  ManuscriptData,
  OperationRecord,
  OperationStatus,
  PaginatedEnvelope,
  RegionInput,
  RegionRecord,
  SceneInput,
  SceneRecord,
  SettingRecord,
  TAXONOMY_TYPES,
  TaxonomyRecord,
  TaxonomyType,
  TextInput,
  TextRecord,
  VersionRecord,
  VersionableResourceType,
  WaitOptions,
  WritingStyleRecord,
} from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BookRhinoClient {
  constructor(public readonly config: BookRhinoConfig) {}

  public resolveUrl(relativeOrAbsoluteUrl?: string | null): string | undefined {
    if (!relativeOrAbsoluteUrl) return undefined;
    if (
      relativeOrAbsoluteUrl.startsWith("http://") ||
      relativeOrAbsoluteUrl.startsWith("https://")
    ) {
      return relativeOrAbsoluteUrl;
    }
    const cleanOrigin = this.config.originUrl.replace(/\/+$/, "");
    const cleanPath = relativeOrAbsoluteUrl.startsWith("/")
      ? relativeOrAbsoluteUrl
      : `/${relativeOrAbsoluteUrl}`;
    return `${cleanOrigin}${cleanPath}`;
  }

  private normalizeImageRecord<T extends ImageRecord | ImageRecord[]>(
    input: T
  ): T {
    if (Array.isArray(input)) {
      return input.map((item) => this.normalizeSingleImage(item)) as T;
    }
    return this.normalizeSingleImage(input) as T;
  }

  private normalizeSingleImage(record: ImageRecord): ImageRecord {
    if (!record || !record.image) return record;
    return {
      ...record,
      image: {
        ...record.image,
        url: this.resolveUrl(record.image.url) || record.image.url,
      },
    };
  }

  private normalizeCharacter(character: CharacterRecord): CharacterRecord {
    if (!character) return character;
    return {
      ...character,
      ...(character.images
        ? { images: character.images.map((img) => this.normalizeSingleImage(img)) }
        : {}),
    };
  }

  private normalizeLocation(location: LocationRecord): LocationRecord {
    if (!location) return location;
    return {
      ...location,
      ...(location.images
        ? { images: location.images.map((img) => this.normalizeSingleImage(img)) }
        : {}),
    };
  }

  private buildQueryString(params?: Record<string, unknown>): string {
    if (!params) return "";
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null || val === "") continue;
      qs.set(key, String(val));
    }
    const serialized = qs.toString();
    return serialized ? `?${serialized}` : "";
  }

  private formatApiError(status: number, data: ApiErrorEnvelope | any, rawText: string): string {
    const errObj = data?.error;
    const code = typeof errObj === "object" && errObj?.code ? errObj.code : undefined;
    const message =
      typeof errObj === "object" && errObj?.message
        ? errObj.message
        : typeof errObj === "string"
          ? errObj
          : rawText || `HTTP ${status}`;
    const details =
      typeof errObj === "object" && errObj?.details && Object.keys(errObj.details).length > 0
        ? ` (details: ${JSON.stringify(errObj.details)})`
        : "";

    if (status === 401) {
      return `Authentication failed (401 Unauthorized): ${message}. Verify BOOK_RHINO_API_KEY is valid and active.`;
    }
    if (status === 403) {
      return `Access denied (403 Forbidden): ${message}`;
    }
    if (status === 404) {
      return `Resource not found (404 Not Found): ${message}`;
    }
    if (status === 422) {
      return `Validation error (422${code ? ` ${code}` : ""}): ${message}${details}`;
    }
    if (status === 400) {
      return `Bad request (400): ${message}${details}`;
    }

    return `Book Rhino API error (HTTP ${status}${code ? ` ${code}` : ""}): ${message}${details}`;
  }

  public async request<T>(endpointPath: string, options: RequestInit = {}): Promise<T> {
    const url = endpointPath.startsWith("http")
      ? endpointPath
      : `${this.config.apiBaseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: any;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text };
      }

      if (!response.ok) {
        throw new Error(this.formatApiError(response.status, parsed, text));
      }

      return parsed as T;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Book Rhino API request timed out after ${this.config.timeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // System, User, Settings & Operations
  // ---------------------------------------------------------------------------

  public async getHealth(): Promise<Record<string, unknown>> {
    const res = await this.request<ApiEnvelope<Record<string, unknown>>>("/health");
    return res.data;
  }

  public async getMe(): Promise<Record<string, unknown>> {
    const res = await this.request<ApiEnvelope<Record<string, unknown>>>("/me");
    return res.data;
  }

  public async getSettings(): Promise<SettingRecord> {
    const res = await this.request<ApiEnvelope<SettingRecord>>("/settings");
    return res.data;
  }

  public async updateSettings(body: Record<string, unknown>): Promise<SettingRecord> {
    const res = await this.request<ApiEnvelope<SettingRecord>>("/settings", {
      method: "PATCH",
      body: JSON.stringify({ setting: body }),
    });
    return res.data;
  }

  public async listOperations(params?: {
    status?: OperationStatus;
    resource_type?: string;
    resource_id?: number;
    operation_type?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<OperationRecord>> {
    return this.request<PaginatedEnvelope<OperationRecord>>(
      `/operations${this.buildQueryString(params)}`
    );
  }

  public async getOperation(id: number): Promise<OperationRecord> {
    const res = await this.request<ApiEnvelope<OperationRecord>>(`/operations/${id}`);
    return res.data;
  }

  public async fetchPolymorphicResource(
    resourceType?: string | null,
    resourceId?: number | null
  ): Promise<unknown> {
    if (!resourceType || !resourceId) return undefined;
    switch (resourceType) {
      case "Book":
        return this.getBook(resourceId);
      case "Chapter":
        return this.getChapter(resourceId, true);
      case "Scene":
        return this.getScene(resourceId);
      case "Character":
        return this.getCharacter(resourceId);
      case "Location":
        return this.getLocation(resourceId);
      case "WritingStyle":
        return this.getWritingStyle(resourceId, false);
      default:
        return undefined;
    }
  }

  public async waitForOperation<TResource = unknown>(
    operationId: number,
    opts?: {
      timeoutMs?: number;
      pollIntervalMs?: number;
      fetchResource?: boolean;
      initialResource?: TResource;
    }
  ): Promise<AsyncExecutionResult<TResource>> {
    const timeoutMs = opts?.timeoutMs ?? this.config.operationTimeoutMs;
    let intervalMs = opts?.pollIntervalMs ?? this.config.pollIntervalMs;
    const deadline = Date.now() + timeoutMs;

    let op = await this.getOperation(operationId);

    while (op.status === "queued" || op.status === "running") {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return {
          status: op.status,
          waited: true,
          timed_out: true,
          operation: op,
          resource: opts?.initialResource,
          hint: `Operation #${op.id} (${op.operation_type}) is still ${op.status} after ${timeoutMs}ms. Use wait_for_operation or get_operation with id=${op.id} to continue tracking.`,
        };
      }

      await sleep(Math.min(intervalMs, remaining));
      intervalMs = Math.min(Math.round(intervalMs * 1.35), 4000);
      op = await this.getOperation(operationId);
    }

    if (op.status === "failed") {
      throw new Error(
        `AI operation #${op.id} (${op.operation_type}) failed [${op.error_class || "Error"}]: ${op.error_message || "Unknown job failure"}`
      );
    }

    let resource: TResource | undefined = opts?.initialResource;
    if (opts?.fetchResource !== false) {
      try {
        const refreshed = await this.fetchPolymorphicResource(op.resource_type, op.resource_id);
        if (refreshed !== undefined) {
          resource = refreshed as TResource;
        }
      } catch {
        // Keep initialResource if resource lookup fails
      }
    }

    return {
      status: op.status,
      waited: true,
      timed_out: false,
      operation: op,
      resource,
    };
  }

  private async resolveAsyncAction<TResource = unknown>(
    accepted: AsyncAcceptedData<TResource>,
    defaultWait: boolean,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<TResource>> {
    const shouldWait = waitOpts?.wait ?? defaultWait;
    if (!shouldWait) {
      return {
        status: accepted.operation.status,
        waited: false,
        timed_out: false,
        operation: accepted.operation,
        resource: accepted.resource,
        hint: `Operation #${accepted.operation.id} (${accepted.operation.operation_type}) queued in background. Call wait_for_operation or get_operation with id=${accepted.operation.id} to monitor.`,
      };
    }

    return this.waitForOperation<TResource>(accepted.operation.id, {
      timeoutMs: waitOpts?.timeoutMs,
      pollIntervalMs: waitOpts?.pollIntervalMs,
      fetchResource: true,
      initialResource: accepted.resource,
    });
  }

  // ---------------------------------------------------------------------------
  // Books
  // ---------------------------------------------------------------------------

  public async listBooks(params?: {
    q?: string;
    writing_style_id?: number;
    perspective_id?: number;
    narrative_structure_id?: number;
    pending?: boolean;
    rendering?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<BookRecord>> {
    return this.request<PaginatedEnvelope<BookRecord>>(`/books${this.buildQueryString(params)}`);
  }

  public async getBook(id: number): Promise<BookRecord> {
    const res = await this.request<ApiEnvelope<BookRecord>>(`/books/${id}`);
    return res.data;
  }

  public async createBook(body: BookInput): Promise<BookRecord> {
    const res = await this.request<ApiEnvelope<BookRecord>>("/books", {
      method: "POST",
      body: JSON.stringify({ book: body }),
    });
    return res.data;
  }

  public async updateBook(id: number, body: BookInput): Promise<BookRecord> {
    const res = await this.request<ApiEnvelope<BookRecord>>(`/books/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ book: body }),
    });
    return res.data;
  }

  public async deleteBook(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(`/books/${id}`, {
      method: "DELETE",
    });
    return res.data;
  }

  public async getBookManuscript(id: number): Promise<ManuscriptData> {
    const res = await this.request<ApiEnvelope<ManuscriptData>>(`/books/${id}/manuscript`);
    return res.data;
  }

  public async generateBookPlot(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<BookRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<BookRecord>>>(
      `/books/${id}/generate_prompt`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async iterateBookPlot(
    id: number,
    message: string,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<BookRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<BookRecord>>>(
      `/books/${id}/iterate`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async renderBook(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<BookRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<BookRecord>>>(
      `/books/${id}/render_book`,
      { method: "POST" }
    );
    // Default wait=false for full book rendering since multi-chapter prose synthesis can take several minutes
    return this.resolveAsyncAction(res.data, false, waitOpts);
  }

  // ---------------------------------------------------------------------------
  // Chapters
  // ---------------------------------------------------------------------------

  public async listChapters(params?: {
    book_id?: number;
    rendering?: boolean;
    include_scenes?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<ChapterRecord>> {
    return this.request<PaginatedEnvelope<ChapterRecord>>(
      `/chapters${this.buildQueryString(params)}`
    );
  }

  public async getChapter(id: number, includeScenes = true): Promise<ChapterRecord> {
    const res = await this.request<ApiEnvelope<ChapterRecord>>(
      `/chapters/${id}${this.buildQueryString({ include_scenes: includeScenes })}`
    );
    return res.data;
  }

  public async createChapter(bookId: number, body: ChapterInput): Promise<ChapterRecord> {
    const res = await this.request<ApiEnvelope<ChapterRecord>>(`/books/${bookId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ chapter: body }),
    });
    return res.data;
  }

  public async updateChapter(id: number, body: ChapterInput): Promise<ChapterRecord> {
    const res = await this.request<ApiEnvelope<ChapterRecord>>(`/chapters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ chapter: body }),
    });
    return res.data;
  }

  public async deleteChapter(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/chapters/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  public async renderChapter(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<ChapterRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<ChapterRecord>>>(
      `/chapters/${id}/render_chapter`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async generateChapterScenes(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<ChapterRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<ChapterRecord>>>(
      `/chapters/${id}/generate_scenes`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  // ---------------------------------------------------------------------------
  // Scenes
  // ---------------------------------------------------------------------------

  public async listScenes(params?: {
    chapter_id?: number;
    book_id?: number;
    rendering?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<SceneRecord>> {
    return this.request<PaginatedEnvelope<SceneRecord>>(`/scenes${this.buildQueryString(params)}`);
  }

  public async getScene(id: number): Promise<SceneRecord> {
    const res = await this.request<ApiEnvelope<SceneRecord>>(`/scenes/${id}`);
    return res.data;
  }

  public async createScene(chapterId: number, body: SceneInput): Promise<SceneRecord> {
    const res = await this.request<ApiEnvelope<SceneRecord>>(`/chapters/${chapterId}/scenes`, {
      method: "POST",
      body: JSON.stringify({ scene: body }),
    });
    return res.data;
  }

  public async updateScene(id: number, body: SceneInput): Promise<SceneRecord> {
    const res = await this.request<ApiEnvelope<SceneRecord>>(`/scenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ scene: body }),
    });
    return res.data;
  }

  public async deleteScene(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(`/scenes/${id}`, {
      method: "DELETE",
    });
    return res.data;
  }

  public async renderScene(
    id: number,
    opts?: { shot_type?: string; style?: string },
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<SceneRecord>> {
    const payload: Record<string, string> = {};
    if (opts?.shot_type) payload.shot_type = opts.shot_type;
    if (opts?.style) payload.style = opts.style;

    const res = await this.request<ApiEnvelope<AsyncAcceptedData<SceneRecord>>>(
      `/scenes/${id}/render_scene`,
      {
        method: "POST",
        ...(Object.keys(payload).length > 0 ? { body: JSON.stringify(payload) } : {}),
      }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  // ---------------------------------------------------------------------------
  // Characters
  // ---------------------------------------------------------------------------

  public async listCharacters(params?: {
    q?: string;
    book_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<CharacterRecord>> {
    return this.request<PaginatedEnvelope<CharacterRecord>>(
      `/characters${this.buildQueryString(params)}`
    );
  }

  public async getCharacter(id: number): Promise<CharacterRecord> {
    const res = await this.request<ApiEnvelope<CharacterRecord>>(`/characters/${id}`);
    return this.normalizeCharacter(res.data);
  }

  public async createCharacter(body: CharacterInput): Promise<CharacterRecord> {
    const res = await this.request<ApiEnvelope<CharacterRecord>>("/characters", {
      method: "POST",
      body: JSON.stringify({ character: body }),
    });
    return this.normalizeCharacter(res.data);
  }

  public async updateCharacter(id: number, body: CharacterInput): Promise<CharacterRecord> {
    const res = await this.request<ApiEnvelope<CharacterRecord>>(`/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ character: body }),
    });
    return this.normalizeCharacter(res.data);
  }

  public async deleteCharacter(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/characters/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  public async generateCharacterPrompt(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<CharacterRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<CharacterRecord>>>(
      `/characters/${id}/generate_prompt`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async iterateCharacterPrompt(
    id: number,
    message: string,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<CharacterRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<CharacterRecord>>>(
      `/characters/${id}/iterate`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  // ---------------------------------------------------------------------------
  // Locations & Regions
  // ---------------------------------------------------------------------------

  public async listLocations(params?: {
    q?: string;
    region_id?: number;
    book_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<LocationRecord>> {
    return this.request<PaginatedEnvelope<LocationRecord>>(
      `/locations${this.buildQueryString(params)}`
    );
  }

  public async getLocation(id: number): Promise<LocationRecord> {
    const res = await this.request<ApiEnvelope<LocationRecord>>(`/locations/${id}`);
    return this.normalizeLocation(res.data);
  }

  public async createLocation(body: LocationInput): Promise<LocationRecord> {
    const res = await this.request<ApiEnvelope<LocationRecord>>("/locations", {
      method: "POST",
      body: JSON.stringify({ location: body }),
    });
    return this.normalizeLocation(res.data);
  }

  public async updateLocation(id: number, body: LocationInput): Promise<LocationRecord> {
    const res = await this.request<ApiEnvelope<LocationRecord>>(`/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ location: body }),
    });
    return this.normalizeLocation(res.data);
  }

  public async deleteLocation(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/locations/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  public async generateLocationPrompt(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<LocationRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<LocationRecord>>>(
      `/locations/${id}/generate_prompt`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async iterateLocationPrompt(
    id: number,
    message: string,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<LocationRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<LocationRecord>>>(
      `/locations/${id}/iterate`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async listRegions(params?: {
    q?: string;
    country?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<RegionRecord>> {
    return this.request<PaginatedEnvelope<RegionRecord>>(`/regions${this.buildQueryString(params)}`);
  }

  public async getRegion(id: number): Promise<RegionRecord> {
    const res = await this.request<ApiEnvelope<RegionRecord>>(`/regions/${id}`);
    return res.data;
  }

  public async createRegion(body: RegionInput): Promise<RegionRecord> {
    const res = await this.request<ApiEnvelope<RegionRecord>>("/regions", {
      method: "POST",
      body: JSON.stringify({ region: body }),
    });
    return res.data;
  }

  public async updateRegion(id: number, body: RegionInput): Promise<RegionRecord> {
    const res = await this.request<ApiEnvelope<RegionRecord>>(`/regions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ region: body }),
    });
    return res.data;
  }

  public async deleteRegion(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/regions/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Writing Styles & Corpus Texts
  // ---------------------------------------------------------------------------

  private serializeWritingStyleBody(body: {
    name?: string;
    prompt?: Record<string, unknown> | string | null;
  }): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = body.name;
    if (body.prompt !== undefined) {
      // Serialize object prompts as JSON strings so Rails strong params (:prompt scalar) accept them cleanly
      payload.prompt =
        body.prompt !== null && typeof body.prompt === "object"
          ? JSON.stringify(body.prompt)
          : body.prompt;
    }
    return payload;
  }

  public async listWritingStyles(params?: {
    q?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<WritingStyleRecord>> {
    return this.request<PaginatedEnvelope<WritingStyleRecord>>(
      `/writing_styles${this.buildQueryString(params)}`
    );
  }

  public async getWritingStyle(id: number, includeTexts = false): Promise<WritingStyleRecord> {
    const res = await this.request<ApiEnvelope<WritingStyleRecord>>(
      `/writing_styles/${id}${includeTexts ? "?include_texts=true" : ""}`
    );
    return res.data;
  }

  public async createWritingStyle(body: {
    name: string;
    prompt?: Record<string, unknown> | string | null;
  }): Promise<WritingStyleRecord> {
    const res = await this.request<ApiEnvelope<WritingStyleRecord>>("/writing_styles", {
      method: "POST",
      body: JSON.stringify({ writing_style: this.serializeWritingStyleBody(body) }),
    });
    return res.data;
  }

  public async updateWritingStyle(
    id: number,
    body: { name?: string; prompt?: Record<string, unknown> | string | null }
  ): Promise<WritingStyleRecord> {
    const res = await this.request<ApiEnvelope<WritingStyleRecord>>(`/writing_styles/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ writing_style: this.serializeWritingStyleBody(body) }),
    });
    return res.data;
  }

  public async deleteWritingStyle(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/writing_styles/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  public async generateWritingStylePrompt(
    id: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<WritingStyleRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<WritingStyleRecord>>>(
      `/writing_styles/${id}/generate_prompt`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async iterateWritingStylePrompt(
    id: number,
    message: string,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<WritingStyleRecord>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<WritingStyleRecord>>>(
      `/writing_styles/${id}/iterate`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  public async listTexts(params?: {
    writing_style_id?: number;
    q?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedEnvelope<TextRecord>> {
    return this.request<PaginatedEnvelope<TextRecord>>(`/texts${this.buildQueryString(params)}`);
  }

  public async getText(id: number): Promise<TextRecord> {
    const res = await this.request<ApiEnvelope<TextRecord>>(`/texts/${id}`);
    return res.data;
  }

  public async createText(writingStyleId: number, body: TextInput): Promise<TextRecord> {
    const res = await this.request<ApiEnvelope<TextRecord>>(
      `/writing_styles/${writingStyleId}/texts`,
      {
        method: "POST",
        body: JSON.stringify({ text: body }),
      }
    );
    return res.data;
  }

  public async updateText(id: number, body: TextInput): Promise<TextRecord> {
    const res = await this.request<ApiEnvelope<TextRecord>>(`/texts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ text: body }),
    });
    return res.data;
  }

  public async deleteText(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(`/texts/${id}`, {
      method: "DELETE",
    });
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Polymorphic Taxonomies (8 creative taxonomy dictionaries)
  // ---------------------------------------------------------------------------

  public async listTaxonomy(
    taxonomy: TaxonomyType,
    params?: { q?: string; page?: number; per_page?: number }
  ): Promise<PaginatedEnvelope<TaxonomyRecord>> {
    return this.request<PaginatedEnvelope<TaxonomyRecord>>(
      `/${taxonomy}${this.buildQueryString(params)}`
    );
  }

  public async getTaxonomy(taxonomy: TaxonomyType, id: number): Promise<TaxonomyRecord> {
    const res = await this.request<ApiEnvelope<TaxonomyRecord>>(`/${taxonomy}/${id}`);
    return res.data;
  }

  public async createTaxonomy(
    taxonomy: TaxonomyType,
    attributes: Record<string, unknown>
  ): Promise<TaxonomyRecord> {
    const res = await this.request<ApiEnvelope<TaxonomyRecord>>(`/${taxonomy}`, {
      method: "POST",
      body: JSON.stringify(attributes),
    });
    return res.data;
  }

  public async updateTaxonomy(
    taxonomy: TaxonomyType,
    id: number,
    attributes: Record<string, unknown>
  ): Promise<TaxonomyRecord> {
    const res = await this.request<ApiEnvelope<TaxonomyRecord>>(`/${taxonomy}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(attributes),
    });
    return res.data;
  }

  public async deleteTaxonomy(
    taxonomy: TaxonomyType,
    id: number
  ): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      `/${taxonomy}/${id}`,
      { method: "DELETE" }
    );
    return res.data;
  }

  public async fetchAllTaxonomiesAndStyles(): Promise<Record<string, unknown[]>> {
    const entries = await Promise.all([
      this.listWritingStyles({ per_page: 100 }).then(
        (res) => ["writing_styles", res.data] as const
      ),
      ...TAXONOMY_TYPES.map((tax) =>
        this.listTaxonomy(tax, { per_page: 100 }).then((res) => [tax, res.data] as const)
      ),
    ]);

    return Object.fromEntries(entries);
  }

  // ---------------------------------------------------------------------------
  // Polymorphic PaperTrail Version History
  // ---------------------------------------------------------------------------

  public async listVersions(
    resourceType: VersionableResourceType,
    resourceId: number,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedEnvelope<VersionRecord>> {
    return this.request<PaginatedEnvelope<VersionRecord>>(
      `/${resourceType}/${resourceId}/versions${this.buildQueryString(params)}`
    );
  }

  public async revertVersion(
    resourceType: VersionableResourceType,
    resourceId: number,
    versionId: number
  ): Promise<unknown> {
    const res = await this.request<ApiEnvelope<unknown>>(
      `/${resourceType}/${resourceId}/versions/${versionId}/revert`,
      { method: "POST" }
    );
    return res.data;
  }

  public async mergeVersion(
    resourceType: VersionableResourceType,
    resourceId: number,
    versionId: number,
    waitOpts?: WaitOptions
  ): Promise<AsyncExecutionResult<unknown>> {
    const res = await this.request<ApiEnvelope<AsyncAcceptedData<unknown>>>(
      `/${resourceType}/${resourceId}/versions/${versionId}/merge`,
      { method: "POST" }
    );
    return this.resolveAsyncAction(res.data, true, waitOpts);
  }

  // ---------------------------------------------------------------------------
  // Polymorphic Character & Location Images
  // ---------------------------------------------------------------------------

  private imageCollectionPath(ownerType: ImageOwnerType, ownerId: number): string {
    return ownerType === "character"
      ? `/characters/${ownerId}/images`
      : `/locations/${ownerId}/images`;
  }

  private imageMemberPath(ownerType: ImageOwnerType, imageId: number): string {
    // Use explicit /character_images/:id and /location_images/:id routes to avoid shallow /images/:id route ambiguity
    return ownerType === "character"
      ? `/character_images/${imageId}`
      : `/location_images/${imageId}`;
  }

  public async listImages(
    ownerType: ImageOwnerType,
    ownerId: number,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedEnvelope<ImageRecord>> {
    const res = await this.request<PaginatedEnvelope<ImageRecord>>(
      `${this.imageCollectionPath(ownerType, ownerId)}${this.buildQueryString(params)}`
    );
    return {
      ...res,
      data: res.data.map((img) => this.normalizeSingleImage(img)),
    };
  }

  public async getImage(ownerType: ImageOwnerType, imageId: number): Promise<ImageRecord> {
    const res = await this.request<ApiEnvelope<ImageRecord>>(
      this.imageMemberPath(ownerType, imageId)
    );
    return this.normalizeSingleImage(res.data);
  }

  public async attachImage(
    ownerType: ImageOwnerType,
    ownerId: number,
    body: {
      title?: string;
      image_url?: string;
      image_base64?: string;
      filename?: string;
      content_type?: string;
    }
  ): Promise<ImageRecord | ImageRecord[]> {
    const res = await this.request<ApiEnvelope<ImageRecord | ImageRecord[]>>(
      this.imageCollectionPath(ownerType, ownerId),
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    return this.normalizeImageRecord(res.data);
  }

  public async updateImage(
    ownerType: ImageOwnerType,
    imageId: number,
    body: { title: string }
  ): Promise<ImageRecord> {
    const res = await this.request<ApiEnvelope<ImageRecord>>(
      this.imageMemberPath(ownerType, imageId),
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
    return this.normalizeSingleImage(res.data);
  }

  public async deleteImage(
    ownerType: ImageOwnerType,
    imageId: number
  ): Promise<{ id: number; deleted: boolean }> {
    const res = await this.request<ApiEnvelope<{ id: number; deleted: boolean }>>(
      this.imageMemberPath(ownerType, imageId),
      { method: "DELETE" }
    );
    return res.data;
  }
}
