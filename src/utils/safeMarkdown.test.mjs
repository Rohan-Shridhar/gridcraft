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

it("does not format emphasis or links inside inline code spans", () => {
  const html = renderSafeMarkdown("`*not italic* **not bold** [x](https://example.com)`");

  assert.equal(html, "<code>*not italic* **not bold** [x](https://example.com)</code>");
});

it("preserves asterisks inside link URLs without corrupting href", () => {
  const html = renderSafeMarkdown("[docs](https://example.com/a*b*c)");

  assert.equal(
    html,
    '<a href="https://example.com/a*b*c" target="_blank" rel="noreferrer noopener">docs</a>'
  );
});
