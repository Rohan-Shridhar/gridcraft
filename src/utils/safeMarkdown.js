function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEmphasis(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
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

  const withoutCode = escaped.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  const withoutLinks = withoutCode.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, href) => stash(`<a href="${href}" target="_blank" rel="noreferrer noopener">${formatEmphasis(label)}</a>`)
  );
  const withEmphasis = formatEmphasis(withoutLinks);
  const restored = withEmphasis.replace(
    new RegExp(`${sentinel}(\\d+)${sentinel}`, "g"),
    (_, index) => placeholders[Number(index)]
  );
  return restored.replace(/\n/g, "<br />");
}
