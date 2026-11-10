import assert from "node:assert/strict";
import { it } from "node:test";
import { renderSafeMarkdown } from "./safeMarkdown.js";

it("escapes HTML and allows only HTTP(S) Markdown links", () => {
  const html = renderSafeMarkdown('<script>alert("x")</script>\n[site](https://example.com) [bad](javascript:alert(1))');

  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /<script>/i);
});
