import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient.js";

function PullState({ pull }) {
  const label = pull.merged ? "Merged" : pull.state;
  return (
    <span className={`issue-state-badge ${pull.merged || pull.state === "closed" ? "issue-state-closed" : ""}`}>
      {label}
    </span>
  );
}

function getErrorMessage(error) {
  return error?.message || "The GitHub request failed.";
}

export default function PullRequestsTab({
  owner,
  repoName,
  repo,
  currentUserLogin,
  showToast,
}) {
  const [pulls, setPulls] = useState([]);
  const [stateFilter, setStateFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPull, setSelectedPull] = useState(null);
  const [pullDetail, setPullDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewEvent, setReviewEvent] = useState("COMMENT");
  const [commentBody, setCommentBody] = useState("");
  const [mergeMethod, setMergeMethod] = useState("merge");
  const [commentPage, setCommentPage] = useState(1);
  const upstream = repo?.parent || null;
  const targetOwner = upstream?.owner || owner;
  const targetRepo = upstream?.name || repoName;
  const targetDefaultBranch = upstream?.defaultBranch || repo?.defaultBranch || "master";

  const [forks, setForks] = useState([]);
  const [sourceFullName, setSourceFullName] = useState(`${owner}/${repoName}`);
  const [sourceBranches, setSourceBranches] = useState([]);
  const [baseBranches, setBaseBranches] = useState([]);
  const [headBranch, setHeadBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState(targetDefaultBranch);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const loadPulls = useCallback(async (nextPage = 1, append = false) => {
    try {
      setIsLoading(true);
      setError("");
      const result = await apiClient.listPulls(owner, repoName, {
        state: stateFilter,
        page: nextPage,
      });
      setPulls((current) => append ? [...current, ...(result.pulls || [])] : (result.pulls || []));
      setPage(nextPage);
      setHasNext(Boolean(result.hasNext));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [owner, repoName, stateFilter]);

  useEffect(() => {
    loadPulls();
  }, [loadPulls]);

  const sourceOptions = useMemo(() => {
    const options = [{ fullName: `${owner}/${repoName}`, owner, name: repoName }];
    for (const fork of forks) {
      if (fork.fullName !== options[0].fullName && fork.parent?.fullName === `${targetOwner}/${targetRepo}`) {
        options.push({ fullName: fork.fullName, owner: fork.owner, name: fork.name });
      }
    }
    return options;
  }, [forks, owner, repoName, targetOwner, targetRepo]);

  const selectedSource = sourceOptions.find((option) => option.fullName === sourceFullName)
    || { fullName: `${owner}/${repoName}`, owner, name: repoName };

  useEffect(() => {
    if (!isCreating) return undefined;
    let active = true;
    async function loadBranches() {
      try {
        setFormError("");
        const [headResult, baseResult] = await Promise.all([
          apiClient.listBranches(selectedSource.owner, selectedSource.name, 1, 100),
          apiClient.listBranches(targetOwner, targetRepo, 1, 100),
        ]);
        if (!active) return;
        const headNames = (headResult.branches || []).map((item) => item.name);
        const baseNames = (baseResult.branches || []).map((item) => item.name);
        setSourceBranches(headNames);
        setBaseBranches(baseNames);
        setHeadBranch((current) => headNames.includes(current) ? current : (
          headNames.includes(headResult.defaultBranch) ? headResult.defaultBranch : (headNames[0] || "")
        ));
        setBaseBranch((current) => baseNames.includes(current) ? current : (
          baseNames.includes("master") ? "master" : (
            baseNames.includes(targetDefaultBranch) ? targetDefaultBranch : (baseNames[0] || "master")
          )
        ));
        try {
          const forkResult = await apiClient.listForks(1, 100);
          if (active) setForks(forkResult.forks || []);
        } catch (forkLoadError) {
          if (active) setFormError(`Branches loaded, but owned forks could not be listed: ${getErrorMessage(forkLoadError)}`);
        }
      } catch (loadError) {
        if (active) setFormError(getErrorMessage(loadError));
      }
    }
    loadBranches();
    return () => { active = false; };
  }, [isCreating, selectedSource.owner, selectedSource.name, targetOwner, targetRepo, targetDefaultBranch]);

  const openCreateForm = () => {
    setTitle("");
    setBody("");
    setFormError("");
    setSourceFullName(`${owner}/${repoName}`);
    setBaseBranch("master");
    setIsCreating(true);
  };

  const loadPullDetail = async (number, nextCommentPage = 1) => {
    try {
      setIsDetailLoading(true);
      setDetailError("");
      const result = await apiClient.getPull(owner, repoName, number, nextCommentPage);
      setPullDetail((current) => {
        if (nextCommentPage === 1 || !current) return result;
        return {
          ...result,
          comments: [...(current.comments || []), ...(result.comments || [])],
        };
      });
      setCommentPage(nextCommentPage);
      setMergeMethod((current) => result.mergeMethods?.[current] ? current : (
        result.mergeMethods?.merge ? "merge" : result.mergeMethods?.squash ? "squash" : "rebase"
      ));
    } catch (loadError) {
      setDetailError(getErrorMessage(loadError));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const openPull = (pull) => {
    setSelectedPull(pull);
    setPullDetail(null);
    setCommentPage(1);
    setReviewBody("");
    setCommentBody("");
    loadPullDetail(pull.number);
  };

  const createPull = async (event) => {
    event.preventDefault();
    if (!title.trim() || !headBranch || !baseBranch) return;
    setIsSubmitting(true);
    setFormError("");
    try {
      const response = await apiClient.createPull(targetOwner, targetRepo, {
        title: title.trim(),
        body,
        head: headBranch,
        base: baseBranch,
        ...(selectedSource.fullName !== `${targetOwner}/${targetRepo}`
          ? { headRepo: selectedSource.fullName }
          : {}),
      });
      setIsCreating(false);
      showToast?.("Pull request created on GitHub.", "success");
      if (targetOwner === owner && targetRepo === repoName) {
        await loadPulls(1);
        openPull(response.pull);
      } else {
        window.open(response.pull.htmlUrl, "_blank", "noopener,noreferrer");
        showToast?.("Your upstream pull request is open on GitHub.", "success");
      }
    } catch (createError) {
      setFormError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!selectedPull || !pullDetail) return;
    setIsSubmitting(true);
    setDetailError("");
    try {
      await apiClient.reviewPull(owner, repoName, selectedPull.number, {
        event: reviewEvent,
        body: reviewBody,
      });
      setReviewBody("");
      showToast?.("Review submitted to GitHub.", "success");
      await loadPullDetail(selectedPull.number);
    } catch (reviewError) {
      setDetailError(getErrorMessage(reviewError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!selectedPull || !commentBody.trim()) return;
    setIsSubmitting(true);
    setDetailError("");
    try {
      await apiClient.commentOnPull(owner, repoName, selectedPull.number, commentBody.trim());
      setCommentBody("");
      await loadPullDetail(selectedPull.number);
    } catch (commentError) {
      setDetailError(getErrorMessage(commentError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const mergePull = async () => {
    const pull = pullDetail?.pull;
    if (!pull || pull.mergeable !== true || pullDetail.permissions?.push !== true) return;
    if (!window.confirm(`Merge pull request #${pull.number} into ${pull.base.repo} using ${mergeMethod}?`)) return;
    setIsSubmitting(true);
    setDetailError("");
    try {
      const result = await apiClient.mergePull(owner, repoName, pull.number, { mergeMethod });
      if (!result.merged) throw new Error(result.message || "GitHub did not merge this pull request.");
      showToast?.("Pull request merged on GitHub.", "success");
      await loadPullDetail(pull.number);
      await loadPulls(1);
    } catch (mergeError) {
      setDetailError(getErrorMessage(mergeError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const commentHasNext = Boolean(pullDetail?.commentsHasNext);
  const pull = pullDetail?.pull;
  const canMerge = pull?.state === "open" && !pull.merged
    && pull.mergeable === true && pullDetail?.permissions?.push === true;
  const mergeMethods = pullDetail?.mergeMethods || {};
  const availableMergeMethods = ["merge", "squash", "rebase"].filter((method) => mergeMethods[method]);

  return (
    <section className="pull-requests-tab" aria-label="Pull Requests">
      {upstream && (
        <div className="upstream-notice">
          <i className="fa-solid fa-code-fork"></i>
          <span>
            Fork of <a href={upstream.htmlUrl} target="_blank" rel="noreferrer">{upstream.fullName}</a>.
            Contributions can be proposed upstream.
          </span>
        </div>
      )}
      <div className="issues-toolbar pull-requests-toolbar">
        <h3>Pull Requests <span className="badge-count">{pulls.length}</span></h3>
        <div className="issue-detail-actions">
          <label>
            <span className="visually-hidden">Pull request state</span>
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </label>
          <button className="btn-primary" onClick={openCreateForm}>
            <i className="fa-solid fa-plus"></i> {upstream ? "Contribute upstream" : "New pull request"}
          </button>
        </div>
      </div>

      {error && <div className="form-error-banner">{error}</div>}
      {isLoading && !pulls.length ? <p className="issues-status">Loading pull requests from GitHub…</p> : null}
      {!isLoading && !error && !pulls.length ? (
        <p className="issues-status">No {stateFilter === "all" ? "" : `${stateFilter} `}pull requests found.</p>
      ) : null}
      {!!pulls.length && (
        <div className="issue-list">
          {pulls.map((item) => (
            <button type="button" className="issue-list-item" key={item.number} onClick={() => openPull(item)}>
              <i className={`fa-solid fa-code-pull-request ${item.state === "open" && !item.merged ? "issue-open" : ""}`} />
              <span className="issue-list-main">
                <strong>#{item.number} {item.title}</strong>
                <small>
                  {item.user?.login ? `@${item.user.login}` : "Unknown author"} opened {new Date(item.createdAt).toLocaleString()}
                  {" · "}{item.head.repo || "deleted fork"}:{item.head.ref} → {item.base.repo}:{item.base.ref}
                </small>
              </span>
              <PullState pull={item} />
            </button>
          ))}
        </div>
      )}
      {isLoading && pulls.length > 0 && <p className="issues-status">Loading…</p>}
      {hasNext && !isLoading && (
        <button className="btn-secondary issue-pagination" onClick={() => loadPulls(page + 1, true)}>
          Load more pull requests
        </button>
      )}

      {isCreating && (
        <div className="modal-backdrop issue-detail-backdrop" role="dialog" aria-modal="true" onClick={() => !isSubmitting && setIsCreating(false)}>
          <form className="modal-container issue-form pull-request-form" onSubmit={createPull} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{upstream ? "Contribute upstream" : "Create pull request"}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsCreating(false)} disabled={isSubmitting}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p className="issue-detail-meta">
              Propose changes to <strong>{targetOwner}/{targetRepo}</strong>. The request will be created on GitHub.
            </p>
            {formError && <div className="form-error-banner">{formError}</div>}
            <label>
              Head repository
              <select value={sourceFullName} onChange={(event) => setSourceFullName(event.target.value)}>
                {sourceOptions.map((option) => <option key={option.fullName} value={option.fullName}>{option.fullName}</option>)}
              </select>
            </label>
            <div className="pull-branch-pair">
              <label>
                Head branch
                <select value={headBranch} onChange={(event) => setHeadBranch(event.target.value)} required>
                  {sourceBranches.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label>
                Base branch
                <select value={baseBranch} onChange={(event) => setBaseBranch(event.target.value)} required>
                  {baseBranches.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            </div>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={256} required />
            </label>
            <label>
              Description
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={65536} />
            </label>
            <p className="issue-detail-meta">Forks and private repositories remain subject to GitHub access and organization policies.</p>
            <div className="modal-footer">
              <button type="button" className="btn-modal-secondary" onClick={() => setIsCreating(false)} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting || !headBranch || !baseBranch}>
                {isSubmitting ? "Creating on GitHub…" : "Create pull request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedPull && (
        <div className="modal-backdrop issue-detail-backdrop" role="dialog" aria-modal="true" onClick={() => setSelectedPull(null)}>
          <div className="modal-container issue-detail pull-request-detail" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>#{selectedPull.number} {pull?.title || selectedPull.title}</h3>
              <button className="modal-close-btn" onClick={() => setSelectedPull(null)} aria-label="Close pull request details">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            {detailError && <div className="form-error-banner">{detailError}</div>}
            {isDetailLoading && !pull ? <p>Loading pull request details…</p> : null}
            {pull && (
              <>
                <div className="issue-detail-meta">
                  <PullState pull={pull} /> <span>by @{pull.user?.login || "unknown"} · opened {new Date(pull.createdAt).toLocaleString()}</span>
                  <a href={pull.htmlUrl} target="_blank" rel="noreferrer">Open on GitHub <i className="fa-solid fa-arrow-up-right-from-square"></i></a>
                  <p>{pull.head.repo || "deleted fork"}:{pull.head.ref} → {pull.base.repo}:{pull.base.ref}</p>
                  <p>
                    Mergeability from GitHub: {pull.merged ? "merged" : pull.mergeable === true ? `mergeable (${pull.mergeableState || "state unavailable"})` : pull.mergeable === false ? "has conflicts" : "being computed"}
                    {" · "}{pull.commits} commits · {pull.changedFiles} files · +{pull.additions} / −{pull.deletions}
                    {pullDetail.permissions?.push ? " · You have write permission" : " · No target-repository write permission"}
                  </p>
                  <p className="pull-description">{pull.body || "No description provided."}</p>
                </div>
                <section>
                  <h4>Commits</h4>
                  {pullDetail.commits?.length ? (
                    <ul className="pull-detail-list">
                      {pullDetail.commits.map((commit) => (
                        <li key={commit.sha}>
                          <a href={commit.htmlUrl} target="_blank" rel="noreferrer"><code>{commit.shortSha}</code></a>
                          <span>{commit.message}</span><small>{commit.author}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="issues-status">No commits returned.</p>}
                </section>
                <section>
                  <h4>Changed files</h4>
                  {pullDetail.files?.length ? (
                    <ul className="pull-detail-list pull-file-list">
                      {pullDetail.files.map((file) => (
                        <li key={`${file.filename}-${file.status}`}>
                          <a href={file.blobUrl} target="_blank" rel="noreferrer"><code>{file.filename}</code></a>
                          <small>{file.status} · +{file.additions} / −{file.deletions}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="issues-status">No changed files returned.</p>}
                </section>
                <section>
                  <h4>Conversation</h4>
                  <div className="issue-comments">
                    {(pullDetail.comments || []).map((comment) => (
                      <article className="issue-comment" key={comment.id}>
                        <small>@{comment.user?.login || "unknown"} · {new Date(comment.createdAt).toLocaleString()}</small>
                        <p className="pull-description">{comment.body}</p>
                      </article>
                    ))}
                    {(pullDetail.reviews || []).map((review) => (
                      <article className="issue-comment" key={`review-${review.id}`}>
                        <small>@{review.user?.login || "unknown"} · {review.state} · {review.submittedAt ? new Date(review.submittedAt).toLocaleString() : ""}</small>
                        {review.body && <p className="pull-description">{review.body}</p>}
                      </article>
                    ))}
                  </div>
                  {commentHasNext && (
                    <button className="btn-secondary" disabled={isDetailLoading} onClick={() => loadPullDetail(selectedPull.number, commentPage + 1)}>
                      Load more comments
                    </button>
                  )}
                  {pull.state === "open" && (
                    <>
                      <form className="issue-comment-form" onSubmit={submitComment}>
                        <label htmlFor="pull-comment">Add a comment</label>
                        <textarea id="pull-comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} maxLength={65536} required />
                        <button className="btn-secondary" disabled={isSubmitting || !commentBody.trim()}>Comment on GitHub</button>
                      </form>
                      {pull.user?.login !== currentUserLogin && (
                        <form className="issue-comment-form pull-review-form" onSubmit={submitReview}>
                          <label htmlFor="pull-review">Submit a review</label>
                          <select value={reviewEvent} onChange={(event) => setReviewEvent(event.target.value)}>
                            <option value="COMMENT">Comment</option>
                            <option value="APPROVE">Approve</option>
                            <option value="REQUEST_CHANGES">Request changes</option>
                          </select>
                          <textarea id="pull-review" value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} rows={3} maxLength={65536} placeholder="Review summary (optional)" />
                          <button className="btn-secondary" disabled={isSubmitting}>Submit review</button>
                        </form>
                      )}
                    </>
                  )}
                </section>
                {pull.state === "open" && !pull.merged && (
                  <div className="pull-merge-actions">
                    {availableMergeMethods.length > 0 && (
                      <select value={mergeMethod} onChange={(event) => setMergeMethod(event.target.value)} aria-label="Merge method">
                        {availableMergeMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    )}
                    <button className="btn-primary" onClick={mergePull} disabled={isSubmitting || !canMerge || !availableMergeMethods.length}>
                      {isSubmitting ? "Merging…" : "Merge pull request"}
                    </button>
                    {!canMerge && <small>{pull.mergeable === false ? "Resolve conflicts on GitHub before merging." : pull.mergeable !== true ? "GitHub has not confirmed mergeability." : "Write permission is required to merge."}</small>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
