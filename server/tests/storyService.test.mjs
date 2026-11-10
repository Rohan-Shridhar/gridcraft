import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StoryService } from "../src/services/storyService.js";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function storyFixture() {
  return {
    format: "gridcraft-story",
    schemaVersion: 1,
    id: "opening",
    name: "Opening",
    description: "",
    loop: true,
    defaultFrameDurationMs: 150,
    frames: [{ artworkId: "frame-one", artworkPath: "artworks/frame-one.json", durationMs: 200 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Story GitHub persistence", () => {
  it("requires a current SHA and rejects stale story updates", async () => {
    let requestCount = 0;
    const service = new StoryService(async () => {
      requestCount += 1;
      return response({ message: "not expected" }, 500);
    });
    await assert.rejects(
      service.saveStory("token", {}, "owner", "repo", "opening", { story: storyFixture() }),
      (error) => error.status === 400 && /SHA is required/.test(error.message)
    );
    assert.equal(requestCount, 0);

    const existing = storyFixture();
    const fetchFn = async () => response({
      sha: "current-sha",
      content: Buffer.from(JSON.stringify(existing)).toString("base64"),
    });
    const staleService = new StoryService(fetchFn);
    await assert.rejects(
      staleService.saveStory("token", {}, "owner", "repo", "opening", {
        story: existing,
        sha: "stale-sha",
      }),
      (error) => error.status === 409
    );
  });

  it("validates referenced artwork and writes the story with SHA to the selected branch", async () => {
    const existing = storyFixture();
    const requests = [];
    const service = new StoryService(async (url, options) => {
      requests.push({ url, options });
      if (url.includes("/contents/stories/opening/story.json") && options.method !== "PUT") {
        return response({
          sha: "current-sha",
          content: Buffer.from(JSON.stringify(existing)).toString("base64"),
        });
      }
      if (url.includes("/contents/artworks/frame-one.json")) return response({ content: "encoded-artwork" });
      if (options.method === "PUT") return response({ content: { sha: "saved-sha" }, commit: { sha: "commit-sha" } });
      throw new Error(`Unexpected request: ${url}`);
    });

    const updated = { ...existing, description: "Updated" };
    const result = await service.saveStory("token", {}, "owner", "repo", "opening", {
      story: updated,
      sha: "current-sha",
    }, "feature/story");

    assert.equal(result.sha, "saved-sha");
    assert.equal(result.story.description, "Updated");
    assert.ok(requests[0].url.endsWith("?ref=feature%2Fstory"));
    assert.ok(requests[1].url.endsWith("?ref=feature%2Fstory"));
    const write = requests.at(-1);
    const payload = JSON.parse(write.options.body);
    assert.equal(payload.branch, "feature/story");
    assert.equal(payload.sha, "current-sha");
  });

  it("surfaces non-404 story listing failures", async () => {
    const service = new StoryService(async () => response({ message: "Forbidden" }, 403));
    await assert.rejects(service.listStories("token", "owner", "repo"), (error) => error.status === 403);
  });
});
