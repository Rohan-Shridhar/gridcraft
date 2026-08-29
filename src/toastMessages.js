const LEADING_TOAST_EMOJI = /^(?:✅|❌|⚠️|ℹ️|🎉|✨|🧹|🚫|👍|👎)\s*/u;

function normalizeToastMessages() {
  document.querySelectorAll('.toast').forEach(toast => {
    const current = toast.textContent || '';
    const normalized = current.replace(LEADING_TOAST_EMOJI, '').trim();
    if (normalized && normalized !== current) toast.textContent = normalized;
  });
}

const observer = new MutationObserver(normalizeToastMessages);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

normalizeToastMessages();
