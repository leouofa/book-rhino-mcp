import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookRhinoClient } from "../src/client.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BookRhinoClient", () => {
  let fetchSpy: any;
  let client: BookRhinoClient;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    client = new BookRhinoClient({
      originUrl: "http://localhost:3000",
      apiBaseUrl: "http://localhost:3000/api/v1",
      apiKey: "br_live_testkey",
      readOnly: false,
      allowAdmin: false,
      timeoutMs: 5000,
      operationTimeoutMs: 500,
      pollIntervalMs: 10,
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("injects Bearer token and normalizes relative ActiveStorage URLs", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 5,
          name: "Aria Vance",
          pending: false,
          images: [
            {
              id: 11,
              title: "Portrait",
              image: {
                url: "/rails/active_storage/blobs/redirect/xyz/aria.png",
                filename: "aria.png",
                content_type: "image/png",
                byte_size: 1024,
              },
            },
          ],
        },
      })
    );

    const char = await client.getCharacter(5);
    expect(char.images?.[0].image?.url).toBe(
      "http://localhost:3000/rails/active_storage/blobs/redirect/xyz/aria.png"
    );

    const [calledUrl, reqInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("http://localhost:3000/api/v1/characters/5");
    expect(reqInit.headers.Authorization).toBe("Bearer br_live_testkey");
  });

  it("serializes WritingStyle object prompts into JSON strings for Rails strong params", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            id: 2,
            name: "Noir",
            prompt: { tone: "cynical", cadence: "clipped" },
            pending: false,
          },
        },
        201
      )
    );

    await client.createWritingStyle({
      name: "Noir",
      prompt: { tone: "cynical", cadence: "clipped" },
    });

    const [, reqInit] = fetchSpy.mock.calls[0];
    const sentBody = JSON.parse(reqInit.body);
    expect(sentBody).toEqual({
      writing_style: {
        name: "Noir",
        prompt: JSON.stringify({ tone: "cynical", cadence: "clipped" }),
      },
    });
  });

  it("routes character vs location image member calls to unambiguous endpoints", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ data: { id: 10, deleted: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 20, deleted: true } }));

    await client.deleteImage("character", 10);
    await client.deleteImage("location", 20);

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:3000/api/v1/character_images/10");
    expect(fetchSpy.mock.calls[1][0]).toBe("http://localhost:3000/api/v1/location_images/20");
  });

  it("polls async operations until succeeded and refreshes the target resource", async () => {
    // 1. POST /characters/7/generate_prompt -> 202
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            operation: {
              id: 88,
              resource_type: "Character",
              resource_id: 7,
              operation_type: "generate_prompt",
              job_class: "GenerateCharacterPromptJob",
              status: "queued",
            },
            resource: { id: 7, name: "Kael", pending: true, prompt: null },
          },
        },
        202
      )
    );

    // 2. GET /operations/88 -> running
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 88,
          resource_type: "Character",
          resource_id: 7,
          operation_type: "generate_prompt",
          job_class: "GenerateCharacterPromptJob",
          status: "running",
        },
      })
    );

    // 3. GET /operations/88 -> succeeded
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 88,
          resource_type: "Character",
          resource_id: 7,
          operation_type: "generate_prompt",
          job_class: "GenerateCharacterPromptJob",
          status: "succeeded",
        },
      })
    );

    // 4. GET /characters/7 -> refreshed character
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 7,
          name: "Kael",
          pending: false,
          prompt: "A seasoned orbital salvager haunted by...",
        },
      })
    );

    const res = await client.generateCharacterPrompt(7);
    expect(res.status).toBe("succeeded");
    expect(res.waited).toBe(true);
    expect(res.timed_out).toBe(false);
    expect(res.resource?.prompt).toContain("orbital salvager");
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("returns timed_out=true cleanly when operation exceeds timeoutMs, and defaults renderBook to wait=false", async () => {
    // renderBook default wait=false
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            operation: {
              id: 91,
              resource_type: "Book",
              resource_id: 3,
              operation_type: "render_book",
              job_class: "RenderBookJob",
              status: "queued",
            },
            resource: { id: 3, title: "Odyssey", rendering: true },
          },
        },
        202
      )
    );

    const noWaitRes = await client.renderBook(3);
    expect(noWaitRes.waited).toBe(false);
    expect(noWaitRes.timed_out).toBe(false);
    expect(noWaitRes.status).toBe("queued");

    // waitForOperation timeout case
    fetchSpy.mockImplementation(async () =>
      jsonResponse({
        data: {
          id: 91,
          resource_type: "Book",
          resource_id: 3,
          operation_type: "render_book",
          job_class: "RenderBookJob",
          status: "running",
        },
      })
    );

    const timeoutRes = await client.waitForOperation(91, { timeoutMs: 25, pollIntervalMs: 10 });
    expect(timeoutRes.waited).toBe(true);
    expect(timeoutRes.timed_out).toBe(true);
    expect(timeoutRes.status).toBe("running");
    expect(timeoutRes.hint).toContain("wait_for_operation");
  });

  it("throws formatted errors on 422 validation failures and failed Sidekiq operations", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "validation_error",
            message: "Name has already been taken",
            details: { name: ["has already been taken"] },
          },
        },
        422
      )
    );

    await expect(
      client.createLocation({ name: "Citadel", description: "Fortress" })
    ).rejects.toThrow(/Validation error \(422 validation_error\): Name has already been taken/);

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 99,
          operation_type: "generate_prompt",
          job_class: "GenerateBookPlotJob",
          status: "failed",
          error_class: "RubyLLM::RateLimitError",
          error_message: "Quota exceeded",
        },
      })
    );

    await expect(client.waitForOperation(99)).rejects.toThrow(
      /AI operation #99 \(generate_prompt\) failed \[RubyLLM::RateLimitError\]: Quota exceeded/
    );
  });
});
