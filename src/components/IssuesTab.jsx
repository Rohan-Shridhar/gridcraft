import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/apiClient.js";
import { renderSafeMarkdown } from "../utils/safeMarkdown.js";

export default function IssuesTab({ owner, repoName, showToast }) {
  const [issues, setIssues] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [state, setState] = useState("open");
  const [author, setAuthor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [labels, setLabels] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [newIssue, setNewIssue] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ title: "", body: "" });
  const [newLabels, setNewLabels] = useState("");
  const [newAssignees, setNewAssignees] = useState("");

  const loadIssues = useCallback(async (nextPage = 1, filters = query) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.listIssues(owner, repoName, {
        ...filters,
        page: nextPage,
        perPage: 20,
      });
      setIssues(result.issues || []);
      setPage(nextPage);
      setHasNext(Boolean(result.hasNext || result.link?.includes('rel="next"')));
    } catch (requestError) {
      setError(requestError.message || "Could not load GridCraft issues.");
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, query]);

  useEffect(() => { loadIssues(1); }, [loadIssues]);

  const openIssue = async (number) => {
    setSelectedNumber(number);
    setDetail(null);
    setDetailError(null);
    setEditing(false);
    try {
      setBusy(true);
      setDetail(await apiClient.getIssue(owner, repoName, number));
    } catch (requestError) {
      setDetailError(requestError.message || "Could not load issue.");
    } finally {
      setBusy(false);
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    const next = {
      state,
      author: author.trim(),
      assignee: assignee.trim(),
      labels: labels.trim(),
      q: search.trim(),
    };
    setQuery(next);
  };

  const create = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.createIssue(owner, repoName, {
        title: title.trim(),
        body,
        labels: newLabels.split(",").map((label) => label.trim()).filter(Boolean),
        assignees: newAssignees.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setNewIssue(false);
      setTitle("");
      setBody("");
      setNewLabels("");
      setNewAssignees("");
      showToast(`GridCraft issue #${result.issue.number} created.`, "success");
      await loadIssues(1);
      await openIssue(result.issue.number);
    } catch (requestError) {
      showToast(requestError.message || "Could not create issue.", "error");
    } finally {
      setCreating(false);
    }
  };

  const saveIssueEdit = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await apiClient.updateIssue(owner, repoName, detail.issue.number, {
        title: editDraft.title,
        body: editDraft.body,
      });
      setDetail((current) => ({ ...current, issue: result.issue }));
      setEditing(false);
      await loadIssues(page);
      showToast("Issue updated.", "success");
    } catch (requestError) {
      showToast(requestError.message || "Could not update issue.", "error");
    } finally {
      setBusy(false);
    }
  };

  const changeState = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const nextState = detail.issue.state === "open" ? "closed" : "open";
      const result = await apiClient.updateIssue(owner, repoName, detail.issue.number, { state: nextState });
      setDetail((current) => ({ ...current, issue: result.issue }));
      await loadIssues(page);
      showToast(nextState === "closed" ? "Issue closed." : "Issue reopened.", "success");
    } catch (requestError) {
      showToast(requestError.message || "Could not change issue state.", "error");
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!detail || !comment.trim()) return;
    setBusy(true);
    try {
      const result = await apiClient.commentOnIssue(owner, repoName, detail.issue.number, comment.trim());
      setDetail((current) => ({ ...current, comments: [...current.comments, result.comment] }));
      setComment("");
    } catch (requestError) {
      showToast(requestError.message || "Could not add comment.", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadMoreComments = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await apiClient.getIssue(owner, repoName, detail.issue.number, (detail.commentsPage || 1) + 1);
      setDetail((current) => ({
        ...current,
        comments: [...current.comments, ...result.comments],
        commentsPage: result.commentsPage,
        commentsHasNext: result.commentsHasNext,
      }));
    } catch (requestError) {
      showToast(requestError.message || "Could not load more comments.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="issues-tab">
      <div className="issues-toolbar">
        <h3><i className="fa-regular fa-circle-dot"></i> GridCraft Issues</h3>
        <button className="btn-primary" onClick={() => setNewIssue(true)}>
          <i className="fa-solid fa-plus"></i> New issue
        </button>
      </div>
      <form className="issue-filters" onSubmit={applyFilters}>
        <select value={state} onChange={(event) => setState(event.target.value)} aria-label="Issue state">
          <option value="open">Open</option><option value="closed">Closed</option><option value="all">All states</option>
        </select>
        <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Author" aria-label="Filter by author" />
        <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assignee" aria-label="Filter by assignee" />
        <input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="Labels (comma-separated)" aria-label="Filter by labels" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title/body" aria-label="Search issues" />
        <button className="btn-secondary" type="submit">Filter</button>
      </form>

      {loading ? <p className="issues-status">Loading GridCraft issues…</p> : error ? (
        <div className="artworks-error"><p>{error}</p><button className="btn-secondary" onClick={() => loadIssues(page)}>Retry</button></div>
      ) : issues.length === 0 ? (
        <div className="artworks-empty"><i className="fa-regular fa-circle-dot"></i><h4>No issues found</h4></div>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => (
            <button className="issue-list-item" key={issue.number} onClick={() => openIssue(issue.number)}>
              <i className={`fa-regular ${issue.state === "open" ? "fa-circle-dot issue-open" : "fa-circle-check"}`}></i>
              <span className="issue-list-main">
                <strong>{issue.title}</strong>
                <small>#{issue.number} opened by @{issue.user.login} · updated {new Date(issue.updatedAt).toLocaleDateString()}</small>
                <span className="issue-labels">{issue.labels.map((label) => <span key={label.name} style={{ "--label-color": `#${label.color || "888888"}` }}>{label.name}</span>)}</span>
              </span>
              {issue.assignees.length > 0 && <small>Assigned: {issue.assignees.map((item) => `@${item.login}`).join(", ")}</small>}
            </button>
          ))}
        </div>
      )}
      <div className="issue-pagination">
        <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => loadIssues(page - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn-secondary" disabled={!hasNext || loading} onClick={() => loadIssues(page + 1)}>Next</button>
      </div>

      {newIssue && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-issue-title" onClick={() => !creating && setNewIssue(false)}>
          <form className="modal-container issue-form" onSubmit={create} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><h3 id="new-issue-title">Create issue</h3><button type="button" className="modal-close-btn" onClick={() => setNewIssue(false)}>×</button></div>
            <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={256} required autoFocus /></label>
            <label>Markdown description<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={65536} rows={8} /></label>
            <label>Labels (comma-separated)<input value={newLabels} onChange={(event) => setNewLabels(event.target.value)} /></label>
            <label>Assignees (usernames, comma-separated)<input value={newAssignees} onChange={(event) => setNewAssignees(event.target.value)} /></label>
            <div className="modal-footer"><button type="button" className="btn-modal-secondary" onClick={() => setNewIssue(false)}>Cancel</button><button type="submit" className="btn-modal-primary" disabled={creating}>{creating ? "Creating…" : "Create issue"}</button></div>
          </form>
        </div>
      )}

      {selectedNumber !== null && (
        <div className="modal-backdrop issue-detail-backdrop" role="dialog" aria-modal="true" aria-labelledby="issue-detail-title" onClick={() => setSelectedNumber(null)}>
          <article className="modal-container issue-detail" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="issue-detail-title">{detail ? `${detail.issue.title} #${detail.issue.number}` : "Issue details"}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedNumber(null)} aria-label="Close">×</button>
            </div>
            {busy && !detail ? <p>Loading issue…</p> : detailError ? <p role="alert">{detailError}</p> : detail && (
              <>
                <div className="issue-detail-meta">
                  {detail.issue.user.avatarUrl && <img src={detail.issue.user.avatarUrl} alt="" />}
                  <span>@{detail.issue.user.login} opened this issue · {new Date(detail.issue.createdAt).toLocaleString()}</span>
                  <span className={`issue-state-badge issue-state-${detail.issue.state}`}>{detail.issue.state}</span>
                </div>
                {editing ? (
                  <>
                    <input value={editDraft.title} maxLength={256} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                    <textarea rows={10} value={editDraft.body} onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))} />
                  </>
                ) : <div className="issue-markdown" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(detail.issue.body) }} />}
                <div className="issue-labels">{detail.issue.labels.map((label) => <span key={label.name} style={{ "--label-color": `#${label.color || "888888"}` }}>{label.name}</span>)}</div>
                <h4>Comments ({detail.comments.length})</h4>
                <div className="issue-comments">
                  {detail.comments.map((item) => (
                    <div className="issue-comment" key={item.id}>
                      <div className="issue-detail-meta">{item.user.avatarUrl && <img src={item.user.avatarUrl} alt="" />}<span>@{item.user.login} · {new Date(item.createdAt).toLocaleString()}</span></div>
                      <div className="issue-markdown" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(item.body) }} />
                    </div>
                  ))}
                </div>
                {detail.commentsHasNext && <button className="btn-secondary" disabled={busy} onClick={loadMoreComments}>Load more comments</button>}
                <form className="issue-comment-form" onSubmit={addComment}>
                  <label htmlFor="issue-comment">Add a comment</label><textarea id="issue-comment" rows={4} maxLength={65536} value={comment} onChange={(event) => setComment(event.target.value)} />
                  <button className="btn-primary" disabled={busy || !comment.trim()}>Comment</button>
                </form>
                <div className="modal-footer issue-detail-actions">
                  {editing ? (
                    <><button className="btn-secondary" onClick={() => setEditing(false)}>Cancel edit</button><button className="btn-primary" disabled={busy || !editDraft.title.trim()} onClick={saveIssueEdit}>Save edit</button></>
                  ) : (
                    <><button className="btn-secondary" disabled={busy} onClick={() => { setEditDraft({ title: detail.issue.title, body: detail.issue.body }); setEditing(true); }}>Edit</button><button className="btn-primary" disabled={busy} onClick={changeState}>{detail.issue.state === "open" ? "Close issue" : "Reopen issue"}</button></>
                  )}
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
