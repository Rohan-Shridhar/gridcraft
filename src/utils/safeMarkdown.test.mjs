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

it("restores inline code spans inside link labels and avoids matching emphasis across newlines or space-padded asterisks", () => {
  const linkWithCode = renderSafeMarkdown("[Run `npm test` *now*](https://example.com)");
  assert.equal(
    linkWithCode,
    '<a href="https://example.com" target="_blank" rel="noreferrer noopener">Run <code>npm test</code> <em>now</em></a>'
  );

  const bulletListAndMath = renderSafeMarkdown("* first item\r\n* second item\r\n2 * 3 * 4");
  assert.equal(bulletListAndMath, "* first item<br />* second item<br />2 * 3 * 4");
});
