import { useEffect, useMemo, useState } from "react";

const REPO = "rohan-shridhar/gridcraft";
const CONTRIBUTORS_API = `https://api.github.com/repos/${REPO}/contributors?per_page=100`;
const CONTRIBUTORS_PAGE = `https://github.com/${REPO}/graphs/contributors`;
const MIN_MARQUEE_ITEMS = 8;

function ContributorCard({ login, avatar_url, html_url }) {
  return (
    <a
      className="contributor-card"
      href={html_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${login} on GitHub`}
    >
      <img
        className="contributor-card-avatar"
        src={avatar_url}
        alt=""
        loading="lazy"
        width={56}
        height={56}
      />
      <span className="contributor-card-name">{login}</span>
    </a>
  );
}

function buildMarqueeItems(contributors) {
  if (!contributors.length) return [];

  let items = [...contributors];
  while (items.length < MIN_MARQUEE_ITEMS) {
    items = [...items, ...contributors];
  }

  return [...items, ...items];
}

function Contributors() {
  const [contributors, setContributors] = useState([]);
  const [status, setStatus] = useState("loading");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const controller = new AbortController();

    async function fetchContributors() {
      setStatus("loading");

      try {
        const response = await fetch(CONTRIBUTORS_API, {
          signal: controller.signal,
          headers: { Accept: "application/vnd.github+json" },
        });

        if (!response.ok) {
          throw new Error(`GitHub API responded with ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          setContributors([]);
          setStatus("empty");
          return;
        }

        setContributors(data);
        setStatus("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        setContributors([]);
        setStatus("error");
      }
    }

    fetchContributors();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const marqueeItems = useMemo(
    () => buildMarqueeItems(contributors),
    [contributors]
  );

  const marqueeDuration = `${Math.max(marqueeItems.length * 4, 24)}s`;
  const displayItems = prefersReducedMotion ? contributors : marqueeItems;

  return (
    <section className="contributors-cont" aria-label="Contributors">
      <h2 className="contributors-title">Contributors</h2>

      {status === "loading" && (
        <p className="contributors-status" role="status">
          Loading contributors...
        </p>
      )}

      {status === "error" && (
        <p className="contributors-status contributors-status--error" role="alert">
          Unable to load contributors.{" "}
          <a href={CONTRIBUTORS_PAGE} target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </p>
      )}

      {status === "empty" && (
        <p className="contributors-status">
          No contributors yet.{" "}
          <a href={CONTRIBUTORS_PAGE} target="_blank" rel="noopener noreferrer">
            Be the first on GitHub
          </a>
        </p>
      )}

      {status === "ready" && (
        <div
          className={`contributors-marquee${prefersReducedMotion ? " contributors-marquee--static" : ""}`}
        >
          <div
            className="contributors-marquee-track"
            style={prefersReducedMotion ? undefined : { "--marquee-duration": marqueeDuration }}
          >
            {displayItems.map((contributor, index) => (
              <ContributorCard
                key={`${contributor.id ?? contributor.login}-${index}`}
                {...contributor}
              />
            ))}
          </div>
        </div>
      )}

      {status === "ready" && (
        <a
          className="contributors-view-all"
          href={CONTRIBUTORS_PAGE}
          target="_blank"
          rel="noopener noreferrer"
        >
          View all contributors on GitHub
        </a>
      )}
    </section>
  );
}

export default Contributors;
