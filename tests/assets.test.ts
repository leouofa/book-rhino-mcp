import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareLocalImageUpload, writeManuscriptFile } from "../src/assets.js";

describe("assets helpers", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "book-rhino-mcp-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("prepares a valid PNG image as a data URI payload", async () => {
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );
    const filePath = path.join(tmpDir, "hero.png");
    await fs.writeFile(filePath, pngBytes);

    const prepared = await prepareLocalImageUpload(filePath);
    expect(prepared.filename).toBe("hero.png");
    expect(prepared.content_type).toBe("image/png");
    expect(prepared.byte_size).toBe(pngBytes.length);
    expect(prepared.image_base64.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("rejects missing, empty, directory, or unsupported image extensions", async () => {
    await expect(prepareLocalImageUpload(path.join(tmpDir, "missing.png"))).rejects.toThrow(
      /not found/
    );

    const emptyFile = path.join(tmpDir, "empty.png");
    await fs.writeFile(emptyFile, "");
    await expect(prepareLocalImageUpload(emptyFile)).rejects.toThrow(/empty/);

    await expect(prepareLocalImageUpload(tmpDir)).rejects.toThrow(/not a regular file/);

    const txtFile = path.join(tmpDir, "notes.txt");
    await fs.writeFile(txtFile, "hello");
    await expect(prepareLocalImageUpload(txtFile)).rejects.toThrow(/Unsupported image file extension/);
  });

  it("writes manuscript Markdown to nested local directories", async () => {
    const outPath = path.join(tmpDir, "exports", "book-1", "manuscript.md");
    const md = "# Starlight Protocol\n\n## Chapter 1: Arrival\n\nThe engines cooled.\n";

    const res = await writeManuscriptFile(outPath, md);
    expect(res.saved_to).toBe(outPath);
    expect(res.bytes_written).toBe(Buffer.byteLength(md, "utf8"));

    const diskContent = await fs.readFile(outPath, "utf8");
    expect(diskContent).toBe(md);
  });
});
