function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEmphasis(text) {
  return text
    .replace(/\*\*(?!\s)([^*\r\n]+?)(?<!\s)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(?!\s)([^*\r\n]+?)(?<!\s)\*/g, "<em>$1</em>");
}

export function renderSafeMarkdown(markdown) {
  const escaped = escapeHtml(markdown || "");
  let sentinel = "\uE000";
  while (escaped.includes(sentinel)) {
    sentinel += "\uE000";
  }

  const placeholders = [];
  const stash = (html) => {
    const id = placeholders.length;
    placeholders.push(html);
    return `${sentinel}${id}${sentinel}`;
  };

  const withoutCode = escaped.replace(/`([^`\r\n]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  const withoutLinks = withoutCode.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, href) => stash(`<a href="${href}" target="_blank" rel="noreferrer noopener">${formatEmphasis(label)}</a>`)
  );
  const withEmphasis = formatEmphasis(withoutLinks);
  const placeholderPattern = new RegExp(`${sentinel}(\\d+)${sentinel}`, "g");
  const restorePlaceholders = (text) =>
    text.replace(placeholderPattern, (_, index) => placeholders[Number(index)]);
  const restored = restorePlaceholders(restorePlaceholders(withEmphasis));
  return restored.replace(/\r?\n/g, "<br />");
}
