import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/apiClient.js";

export default function BranchesTab({ owner, repoName, branch, onSelectBranch, showToast }) {
  const [branches, setBranches] = useState([]);
  const [defaultBranch, setDefaultBranch] = useState("master");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [base, setBase] = useState(branch);
  const [head, setHead] = useState("");
  const [comparison, setComparison] = useState(null);
  const [commits, setCommits] = useState([]);
  const [commitPage, setCommitPage] = useState(1);
  const [newBranch, setNewBranch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    setIsLoading(true);
    try {
      const result = await apiClient.listBranches(owner, repoName, nextPage);
      setBranches((current) => nextPage === 1 ? result.branches : [...current, ...result.branches]);
      setDefaultBranch(result.defaultBranch || "master");
      setPage(nextPage);
      setHasMore(Boolean(result.link?.includes('rel="next"')));
    } catch (error) {
      showToast(error.message || "Could not load branches.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [owner, repoName, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setBase(branch); }, [branch]);

  const loadCommits = async (nextPage = 1) => {
    try {
      const result = await apiClient.listBranchCommits(owner, repoName, branch, nextPage);
      setCommits((current) => nextPage === 1 ? result.commits : [...current, ...result.commits]);
      setCommitPage(nextPage);
    } catch (error) {
      showToast(error.message || "Could not load branch history.", "error");
    }
  };
  useEffect(() => { loadCommits(); }, [owner, repoName, branch]);

  const create = async (event) => {
    event.preventDefault();
    if (!newBranch.trim()) return;
    try {
      await apiClient.createBranch(owner, repoName, { name: newBranch.trim(), from: branch });
      const createdName = newBranch.trim();
      setNewBranch("");
      await load();
      onSelectBranch(createdName);
      showToast(`Branch "${createdName}" created.`, "success");
    } catch (error) {
      showToast(error.message || "Could not create branch.", "error");
    }
  };

  const rename = async (item) => {
    const newName = window.prompt("Rename branch", item.name);
    if (!newName?.trim() || newName.trim() === item.name) return;
    if (!window.confirm(`Rename branch "${item.name}" to "${newName.trim()}"?`)) return;
    try {
      await apiClient.renameBranch(owner, repoName, item.name, newName.trim());
      if (branch === item.name) onSelectBranch(newName.trim());
      await load();
      showToast("Branch renamed.", "success");
    } catch (error) {
      showToast(error.message || "Could not rename branch.", "error");
    }
  };

  const remove = async (item) => {
    if (item.isDefault || item.name === defaultBranch) return;
    if (!window.confirm(`Delete branch "${item.name}"?`)) return;
    try {
      await apiClient.deleteBranch(owner, repoName, item.name);
      if (branch === item.name) onSelectBranch(defaultBranch);
      await load();
      showToast("Branch deleted.", "success");
    } catch (error) {
      showToast(error.message || "Could not delete branch.", "error");
    }
  };

  const compare = async (event) => {
    event.preventDefault();
    try {
      setComparison(await apiClient.compareBranches(owner, repoName, base, head));
    } catch (error) {
      showToast(error.message || "Could not compare branches.", "error");
    }
  };

  return (
    <div className="branches-tab">
      <form className="inline-create-form" onSubmit={create}>
        <input value={newBranch} onChange={(event) => setNewBranch(event.target.value)} placeholder="New branch name" maxLength={100} required />
        <button className="btn-primary" type="submit">Create from {branch}</button>
      </form>
      <h3>Branches <span className="badge-branch">{defaultBranch} is default</span></h3>
      {isLoading && !branches.length ? <p>Loading branches…</p> : (
        <div className="branch-list">
          {branches.map((item) => (
            <div className="branch-list-item" key={item.name}>
              <button className="branch-name-button" onClick={() => onSelectBranch(item.name)}>
                <i className="fa-solid fa-code-branch"></i> {item.name}
                {item.name === defaultBranch && <span className="badge-verified">Default</span>}
                {item.protected && <span className="badge-branch">Protected</span>}
              </button>
              <code>{item.sha?.slice(0, 7)}</code>
              {item.name !== defaultBranch && (
                <div className="branch-actions">
                  <button className="btn-secondary" onClick={() => rename(item)}>Rename</button>
                  <button className="btn-artwork-delete" onClick={() => remove(item)} title={`Delete ${item.name}`}>
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {hasMore && <button className="btn-secondary" onClick={() => load(page + 1)}>Load more branches</button>}

      <section className="overview-section branch-compare">
        <h3>Compare branches</h3>
        <form className="inline-create-form" onSubmit={compare}>
          <select value={base} onChange={(event) => setBase(event.target.value)} aria-label="Base branch">
            {branches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          <select value={head} onChange={(event) => setHead(event.target.value)} aria-label="Compare branch" required>
            <option value="">Select head branch</option>
            {branches.filter((item) => item.name !== base).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          <button className="btn-secondary" type="submit" disabled={!head}>Compare</button>
        </form>
        {comparison && (
          <div className="branch-comparison">
            <p>{comparison.status}: {comparison.aheadBy} ahead, {comparison.behindBy} behind; {comparison.totalCommits} commits</p>
            {comparison.permalinkUrl && <a href={comparison.permalinkUrl} target="_blank" rel="noreferrer">Open actual GitHub comparison</a>}
            <h4>Changed files</h4>
            {comparison.files?.map((file) => (
              <div className="branch-list-item" key={file.filename}>
                <code>{file.filename}</code><span>{file.status} · +{file.additions} / −{file.deletions}</span>
              </div>
            ))}
            <h4>Commits</h4>
            {comparison.commits?.map((commit) => (
              <div className="commit-item" key={commit.sha}>
                <span>{commit.message}</span><a href={commit.htmlUrl} target="_blank" rel="noreferrer"><code>{commit.shortSha}</code></a>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overview-section">
        <h3>Recent commits on <code>{branch}</code></h3>
        {!commits.length ? <p>No commits found.</p> : commits.map((commit) => (
          <div className="commit-item" key={commit.sha}>
            <span>{commit.message}<small> by @{commit.authorLogin} · {new Date(commit.date).toLocaleString()}</small></span>
            <a href={commit.htmlUrl} target="_blank" rel="noreferrer"><code>{commit.shortSha}</code></a>
          </div>
        ))}
        {commits.length >= 20 && <button className="btn-secondary" onClick={() => loadCommits(commitPage + 1)}>More commits</button>}
      </section>
    </div>
  );
}
