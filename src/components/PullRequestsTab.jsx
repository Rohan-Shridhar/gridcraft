import { useCallback, useEffect, useState } from "react";
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
  return error?.message || "The GridCraft request failed.";
}

export default function PullRequestsTab({
  owner,
  repoName,
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
  const [commentPage, setCommentPage] = useState(1);
  const [sourceAlbums, setSourceAlbums] = useState([]);
  const [sourceFullName, setSourceFullName] = useState("");
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

  useEffect(() => {
    if (!isCreating) return undefined;
    let active = true;
    async function loadSourceAlbums() {
      try {
        setFormError("");
        const albums = [];
        let nextPage = 1;
        let total = 0;
        do {
          const result = await apiClient.listAlbums(nextPage, 100);
          albums.push(...(result.albums || []));
          total = result.total || albums.length;
          nextPage += 1;
        } while (active && albums.length < total);
        if (!active) return;
        const owned = albums.filter((album) =>
          album.owner?.toLowerCase() === currentUserLogin?.toLowerCase()
          && !(album.owner?.toLowerCase() === owner.toLowerCase() && album.slug === repoName)
        );
        setSourceAlbums(owned);
        setSourceFullName((current) => owned.some((album) => `${album.owner}/${album.slug}` === current)
          ? current
          : (owned[0] ? `${owned[0].owner}/${owned[0].slug}` : ""));
      } catch (loadError) {
        if (active) setFormError(getErrorMessage(loadError));
      }
    }
    loadSourceAlbums();
    return () => { active = false; };
  }, [isCreating, currentUserLogin, owner, repoName]);

  const openCreateForm = () => {
    setTitle("");
    setBody("");
    setFormError("");
    setSourceFullName("");
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
    if (!title.trim() || !sourceFullName) return;
    setIsSubmitting(true);
    setFormError("");
    try {
      const [headOwner, headAlbum] = sourceFullName.split("/");
      const response = await apiClient.createPull(owner, repoName, {
        title: title.trim(),
        body,
        headOwner,
        headAlbum,
      });
      setIsCreating(false);
      showToast?.("GridCraft pull request created.", "success");
      await loadPulls(1);
      openPull(response.pull);
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
      showToast?.("Review submitted.", "success");
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
    if (!pull || pull.state !== "open" || pullDetail.permissions?.push !== true) return;
    if (!window.confirm(`Copy the proposed story and artwork files from ${pull.head.repo} into ${pull.base.repo}?`)) return;
    setIsSubmitting(true);
    setDetailError("");
    try {
      const result = await apiClient.mergePull(owner, repoName, pull.number);
      if (!result.merged) throw new Error(result.message || "GridCraft could not merge this pull request.");
      showToast?.("Pull request merged.", "success");
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
    && pullDetail?.permissions?.push === true;

  return (
    <section className="pull-requests-tab" aria-label="Pull Requests">
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
            <i className="fa-solid fa-plus"></i> New pull request
          </button>
        </div>
      </div>

      {error && <div className="form-error-banner">{error}</div>}
      {isLoading && !pulls.length ? <p className="issues-status">Loading GridCraft pull requests…</p> : null}
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
              <h3>Create pull request</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsCreating(false)} disabled={isSubmitting}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p className="issue-detail-meta">
              Propose changes to <strong>{owner}/{repoName}</strong> from one of your albums.
            </p>
            {formError && <div className="form-error-banner">{formError}</div>}
            <label>
              Source album
              <select value={sourceFullName} onChange={(event) => setSourceFullName(event.target.value)} required>
                <option value="">Select an album</option>
                {sourceAlbums.map((album) => {
                  const fullName = `${album.owner}/${album.slug}`;
                  return <option key={album.id} value={fullName}>{fullName}</option>;
                })}
              </select>
              {!sourceAlbums.length && <small>Create or fork another album before opening a pull request.</small>}
            </label>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={256} required />
            </label>
            <label>
              Description
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={65536} />
            </label>
            <p className="issue-detail-meta">Pull requests are managed by GridCraft. Merging copies source story and artwork files into this album.</p>
            <div className="modal-footer">
              <button type="button" className="btn-modal-secondary" onClick={() => setIsCreating(false)} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting || !sourceFullName}>
                {isSubmitting ? "Creating…" : "Create pull request"}
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
                  <p>{pull.head.repo} → {pull.base.repo}</p>
                  <p>
                    GridCraft status: {pull.merged ? "merged" : pull.state}
                    {" · "}{pull.changedFiles} changed files
                    {pullDetail.permissions?.push ? " · You can merge this request" : " · Only the album owner can merge"}
                  </p>
                  <p className="pull-description">{pull.body || "No description provided."}</p>
                </div>
                <section>
                  <h4>Changed files</h4>
                  {pullDetail.files?.length ? (
                    <ul className="pull-detail-list pull-file-list">
                      {pullDetail.files.map((file) => (
                        <li key={`${file.filename}-${file.status}`}>
                          <code>{file.filename}</code>
                          <small>{file.status}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="issues-status">No files in this proposal.</p>}
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
                        <button className="btn-secondary" disabled={isSubmitting || !commentBody.trim()}>Comment</button>
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
                      <button className="btn-primary" onClick={mergePull} disabled={isSubmitting || !canMerge}>
                        {isSubmitting ? "Merging…" : "Merge pull request"}
                      </button>
                      {!canMerge && <small>{pull.state !== "open" ? "This request is not open." : "Only the base album owner can merge."}</small>}
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
