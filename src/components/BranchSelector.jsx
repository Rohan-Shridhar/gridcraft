import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/apiClient.js";

export default function BranchSelector({ owner, repoName, branch, onChange, showToast }) {
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    try {
      const result = await apiClient.listBranches(owner, repoName, nextPage);
      setBranches((current) => nextPage === 1 ? result.branches : [...current, ...result.branches]);
      setPage(nextPage);
      setHasMore(Boolean(result.link?.includes('rel="next"')));
    } catch (error) {
      showToast(error.message || "Could not load repository branches.", "error");
    }
  }, [owner, repoName, branch, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const options = branches.some((item) => item.name === branch)
    ? branches
    : [{ name: branch, isDefault: branch === "master" }, ...branches];

  return (
    <div className="branch-selector">
      <i className="fa-solid fa-code-branch" aria-hidden="true"></i>
      <label>
        <span className="visually-hidden">Current branch</span>
        <select value={branch} onChange={(event) => onChange(event.target.value)} aria-label="Current branch">
          {options.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}{item.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
      {hasMore && (
        <button type="button" className="btn-secondary branch-load-more" onClick={() => load(page + 1)}>
          More branches
        </button>
      )}
    </div>
  );
}
