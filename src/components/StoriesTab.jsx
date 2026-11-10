import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient.js";
import { sanitizeArtworkId, snapsToMigrationPlan } from "../utils/snapToStory.mjs";
import { downloadGif, encodeStoryGif } from "../utils/gifExport.mjs";
import { createSnapExportData } from "../utils/snapExport.mjs";
import ArtworkThumbnail from "./ArtworkThumbnail.jsx";
import ArtworksTab from "./ArtworksTab.jsx";

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uniqueId(base, used) {
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

export default function StoriesTab({ owner, repoName, branch = "master", localSnaps = [], onDirtyChange, onOpenArtwork, showToast }) {
  const [stories, setStories] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [storyDoc, setStoryDoc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selectedArtwork, setSelectedArtwork] = useState("");
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [draggedFrame, setDraggedFrame] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const storyResult = await apiClient.listStories(owner, repoName, branch);
      setStories(storyResult.stories || []);
    } catch (requestError) {
      setError(requestError.message || "Failed to load album stories and artworks.");
    } finally {
      setIsLoading(false);
    }
  }, [owner, repoName, branch]);

  useEffect(() => { load(); }, [load]);

  const artworkById = useMemo(() => new Map(artworks.map((artwork) => [artwork.id, artwork])), [artworks]);
  const frames = draft?.frames || [];
  const playbackFrames = useMemo(() => frames.map((frame) => ({
    ...frame,
    artwork: artworkById.get(frame.artworkId),
  })), [frames, artworkById]);
  const hasUnsavedChanges = Boolean(storyDoc && draft &&
    JSON.stringify(storyDoc.story) !== JSON.stringify(draft));

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
    return () => onDirtyChange?.(false);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    setStoryDoc(null);
    setDraft(null);
    setPlayingIndex(-1);
  }, [owner, repoName, branch]);

  useEffect(() => {
    if (playingIndex < 0 || !playbackFrames.length) return undefined;
    const duration = playbackFrames[playingIndex]?.durationMs || draft.defaultFrameDurationMs;
    const timer = window.setTimeout(() => {
      if (playingIndex + 1 < playbackFrames.length) setPlayingIndex(playingIndex + 1);
      else if (draft.loop) setPlayingIndex(0);
      else setPlayingIndex(-1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [playingIndex, playbackFrames, draft]);

  const openStory = async (storyId, autoplay = false) => {
    if (hasUnsavedChanges && !window.confirm("Open another Story and discard your unsaved changes?")) return;
    setPlayingIndex(-1);
    try {
      const [result, artworkResult] = await Promise.all([
        apiClient.getStory(owner, repoName, storyId, branch),
        apiClient.listArtworks(owner, repoName, storyId, branch),
      ]);
      setStoryDoc(result);
      setDraft(result.story);
      setArtworks(artworkResult.artworks || []);
      if (autoplay && result.story.frames.length) setPlayingIndex(0);
    } catch (requestError) {
      showToast(requestError.message || "Could not load this story.", "error");
    }
  };

  const createStory = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (hasUnsavedChanges && !window.confirm("Create another Story and discard your current unsaved changes?")) return;
    setCreating(true);
    try {
      const result = await apiClient.createStory(owner, repoName, {
        name: name.trim(),
        description: description.trim(),
        loop: true,
        defaultFrameDurationMs: 150,
        frames: [],
      }, branch);
      setName("");
      setDescription("");
      await load();
      setStoryDoc({ story: result.story, sha: result.sha });
      setDraft(result.story);
      setArtworks([]);
      showToast(`Story "${result.story.name}" created.`, "success");
    } catch (requestError) {
      showToast(requestError.message || "Could not create story.", "error");
    } finally {
      setCreating(false);
    }
  };

  const saveStory = async () => {
    if (!storyDoc || !draft) return;
    setSaving(true);
    try {
      const result = await apiClient.saveStory(owner, repoName, draft.id, {
        story: draft,
        sha: storyDoc.sha,
      }, branch);
      setStoryDoc(result);
      setDraft(result.story);
      await load();
      showToast("Story saved to GitHub.", "success");
    } catch (requestError) {
      showToast(requestError.message || "Could not save story.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addFrame = () => {
    if (!selectedArtwork) return;
    setDraft((current) => ({
      ...current,
      frames: [...current.frames, {
        artworkId: selectedArtwork,
        artworkPath: `${selectedArtwork}.json`,
        durationMs: current.defaultFrameDurationMs,
      }],
    }));
  };

  const removeFrame = (index) => {
    setDraft((current) => ({ ...current, frames: current.frames.filter((_, frameIndex) => frameIndex !== index) }));
    setPlayingIndex(-1);
  };

  const moveFrame = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= frames.length) return;
    setDraft((current) => {
      const next = [...current.frames];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, frames: next };
    });
  };

  const reorderFrames = (from, to) => {
    if (from < 0 || to < 0 || from === to) return;
    setDraft((current) => {
      const next = [...current.frames];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, frames: next };
    });
    setPlayingIndex(-1);
  };

  const goToFrame = (index) => {
    if (!frames.length) return;
    setPlayingIndex(Math.max(0, Math.min(frames.length - 1, index)));
  };

  const advanceFrame = (direction) => {
    if (!frames.length) return;
    if (playingIndex < 0) {
      setPlayingIndex(direction > 0 ? 0 : frames.length - 1);
      return;
    }
    const next = playingIndex + direction;
    if (next >= frames.length) setPlayingIndex(draft.loop ? 0 : -1);
    else if (next < 0) setPlayingIndex(draft.loop ? frames.length - 1 : 0);
    else setPlayingIndex(next);
  };

  const updateFrameDuration = (index, durationMs) => {
    const duration = Math.min(10000, Math.max(20, Math.round(Number(durationMs) || 20)));
    setDraft((current) => ({
      ...current,
      frames: current.frames.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, durationMs: duration } : frame
      ),
    }));
  };

  const deleteStory = async (story) => {
    const unsavedWarning = storyDoc?.story.id === story.id && hasUnsavedChanges
      ? " Your unsaved Story changes will also be lost."
      : "";
    if (!window.confirm(`Delete story "${story.name}"?${unsavedWarning}`)) return;
    try {
      await apiClient.deleteStory(owner, repoName, story.id, story.sha, branch);
      setStories((current) => current.filter((item) => item.id !== story.id));
      if (storyDoc?.story.id === story.id) {
        setStoryDoc(null);
        setDraft(null);
      }
      showToast("Story deleted.", "success");
    } catch (requestError) {
      showToast(requestError.message || "Could not delete story.", "error");
    }
  };

  const exportGif = () => {
    try {
      const exportFrames = playbackFrames.map(({ artwork, durationMs }) => {
        if (!artwork) throw new Error("A Story artwork is missing on this branch. Reload the story before exporting.");
        return { ...artwork, durationMs };
      });
      const { bytes } = encodeStoryGif(exportFrames, { loop: draft.loop });
      downloadGif(bytes, `${draft.id}.gif`);
    } catch (requestError) {
      showToast(requestError.message || "Could not export GIF.", "error");
    }
  };

  const backupSnaps = () => {
    downloadJson(createSnapExportData(localSnaps), "gridcraft-snaps-backup.json");
    showToast("A JSON backup of your local Snaps was downloaded.", "success");
  };

  const migrateSnaps = async () => {
    if (!localSnaps.length) return;
    const plan = snapsToMigrationPlan(localSnaps, { albumId: `${owner}/${repoName}` });
    if (!plan.artworks.length) {
      showToast("No valid local Snaps are available to migrate.", "error");
      return;
    }
    const skipped = plan.skippedCount ? ` ${plan.skippedCount} invalid Snap(s) will be skipped.` : "";
    const truncated = plan.truncatedMetadataCount
      ? ` Captions/notes on ${plan.truncatedMetadataCount} Snap(s) exceed the artwork description limit and will be truncated; keep the JSON backup for complete metadata.`
      : "";
    const ok = window.confirm(
      `Migrate ${plan.artworks.length} local Snap(s) into this album? This creates artworks and a Story on GitHub. Local Snaps will be preserved.${skipped}${truncated}`
    );
    if (!ok) return;
    setMigrating(true);
    const createdArtworkIds = [];
    try {
      const usedStoryIds = new Set(stories.map((story) => story.id));
      const storyName = uniqueId("migrated-snaps", usedStoryIds);
      const storyResult = await apiClient.createStory(owner, repoName, {
        name: storyName,
        description: plan.story.description,
        loop: plan.story.loop,
        defaultFrameDurationMs: plan.story.defaultFrameDurationMs,
        frames: [],
      }, branch);
      const usedArtworkIds = new Set();
      const idMap = new Map();
      for (const artwork of plan.artworks) {
        const id = uniqueId(artwork.id, usedArtworkIds);
        idMap.set(artwork.id, id);
        const baseId = sanitizeArtworkId(artwork.name);
        const suffix = id.startsWith(`${baseId}-`) ? id.slice(baseId.length + 1) : "";
        const artworkName = id === baseId ? artwork.name : baseId ? `${artwork.name} ${suffix}` : id;
        const created = await apiClient.createArtwork(owner, repoName, storyName, {
          name: artworkName,
          description: artwork.description,
          gridSize: artwork.gridSize,
          backgroundColor: artwork.backgroundColor,
          cells: artwork.cells,
        }, branch);
        if (created.artwork.id !== id) {
          throw new Error(`Created artwork ID "${created.artwork.id}" did not match expected migration ID "${id}".`);
        }
        createdArtworkIds.push(created.artwork.id);
      }
      const savedStory = await apiClient.saveStory(owner, repoName, storyName, {
        sha: storyResult.sha,
        story: {
          ...storyResult.story,
          frames: plan.story.frames.map((frame) => {
          const artworkId = idMap.get(frame.artworkId);
          return { ...frame, artworkId, artworkPath: `${artworkId}.json` };
          }),
        },
      }, branch);
      await load();
      setStoryDoc(savedStory);
      setDraft(savedStory.story);
      const artworkResult = await apiClient.listArtworks(owner, repoName, storyName, branch);
      setArtworks(artworkResult.artworks || []);
      showToast(`Snaps migrated into a Story. Your original local Snaps remain untouched.${plan.skippedCount ? ` Skipped ${plan.skippedCount} invalid Snap(s).` : ""}`, "success");
    } catch (requestError) {
      const partial = createdArtworkIds.length
        ? ` ${createdArtworkIds.length} artwork(s) were created before the failure; local Snaps are unchanged.`
        : "";
      showToast(`${requestError.message || "Snap migration failed."}${partial}`, "error");
      await load();
    } finally {
      setMigrating(false);
    }
  };

  if (isLoading) {
    return <div className="artworks-loading"><i className="fa-solid fa-spinner fa-spin"></i><span>Loading stories from GitHub…</span></div>;
  }
  if (error) {
    return <div className="artworks-error"><p>{error}</p><button className="btn-secondary" onClick={load}>Retry</button></div>;
  }

  return (
    <div className="stories-tab">
      <form className="inline-create-form" onSubmit={createStory}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New story name" maxLength={100} required />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" maxLength={500} />
        <button className="btn-primary" disabled={creating} type="submit">{creating ? "Creating…" : "New Story"}</button>
      </form>

      {localSnaps.length > 0 && (
        <section className="snap-migration">
          <div><h4>Local Snaps backup and migration</h4><p>{localSnaps.length} Snap(s) are stored in this browser. Migration preserves the originals.</p></div>
          <button className="btn-secondary" onClick={backupSnaps}>Download JSON backup</button>
          <button className="btn-primary" disabled={migrating} onClick={migrateSnaps}>{migrating ? "Migrating…" : "Migrate to Story"}</button>
        </section>
      )}

      {stories.length === 0 ? (
        <div className="artworks-empty"><i className="fa-solid fa-film"></i>        <h4>No stories yet</h4><p>A Story is an ordered sequence of artworks within this album.</p></div>
      ) : (
        <div className="artworks-grid">
          {stories.map((story) => (
            <div key={story.id} className={`artwork-card${draft?.id === story.id ? " story-card-selected" : ""}`}>
              <button className="story-card-open" onClick={() => openStory(story.id)}>
                <span className="story-card-thumb">
                  {draft?.id === story.id && story.frames?.[0] && artworkById.get(story.frames[0].artworkId) && (
                    <ArtworkThumbnail
                      cells={artworkById.get(story.frames[0].artworkId).cells}
                      gridSize={artworkById.get(story.frames[0].artworkId).gridSize}
                      backgroundColor={artworkById.get(story.frames[0].artworkId).backgroundColor}
                    />
                  )}
                </span>
                <span className="artwork-card-info"><strong className="artwork-card-name">{story.name}</strong><span className="artwork-card-desc">{story.description || "No description"}</span><small>{story.frames?.length || 0} frames · {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : ""}</small></span>
              </button>
              <button className="btn-secondary story-card-play" onClick={() => openStory(story.id, true)} title={`Play ${story.name}`} disabled={!story.frames?.length}>
                <i className="fa-solid fa-play"></i>
              </button>
              <button className="btn-artwork-delete" onClick={() => deleteStory(story)} title={`Delete ${story.name}`}><i className="fa-solid fa-trash-can"></i></button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <section className="story-editor">
          <ArtworksTab
            owner={owner}
            repoName={repoName}
            storyId={draft.id}
            branch={branch}
            onOpenEditor={(artworkId) => onOpenArtwork?.(draft.id, artworkId)}
            showToast={showToast}
          />
          <div className="story-editor-header">
            <div><h3>{draft.name}</h3><p>{draft.description || "Edit the ordered frames in this Story."}</p></div>
            <div className="story-editor-actions">
              <button className="btn-secondary" disabled={!frames.length} onClick={() => advanceFrame(-1)} aria-label="Previous frame">Previous</button>
              <button className="btn-secondary" disabled={!frames.length} onClick={() => setPlayingIndex(playingIndex < 0 ? 0 : -1)}>{playingIndex < 0 ? "Play" : "Pause"}</button>
              <button className="btn-secondary" disabled={!frames.length} onClick={() => advanceFrame(1)} aria-label="Next frame">Next</button>
              <button className="btn-secondary" disabled={!frames.length} onClick={() => setPlayingIndex(0)}>Restart</button>
              <button className="btn-secondary" disabled={!frames.length} onClick={exportGif}>Export GIF</button>
              <button className="btn-primary" disabled={saving || !hasUnsavedChanges} onClick={saveStory}>{saving ? "Saving…" : "Save Story"}</button>
            </div>
          </div>
          {frames.length > 0 && <input className="story-timeline" type="range" min="0" max={frames.length - 1} value={Math.max(0, playingIndex)} onChange={(event) => goToFrame(Number(event.target.value))} aria-label="Story preview timeline" />}
          <div className="story-settings">
            <label>Name<input value={draft.name} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Description<input value={draft.description} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <label>Default frame (ms)<input type="number" min="20" max="10000" value={draft.defaultFrameDurationMs} onChange={(event) => setDraft((current) => ({ ...current, defaultFrameDurationMs: Math.min(10000, Math.max(20, Math.round(Number(event.target.value) || 20))) }))} /></label>
            <label className="story-loop-control"><input type="checkbox" checked={draft.loop} onChange={(event) => setDraft((current) => ({ ...current, loop: event.target.checked }))} /> Loop playback</label>
          </div>
          <form className="inline-create-form" onSubmit={(event) => { event.preventDefault(); addFrame(); }}>
            <select aria-label="Artwork to add" value={selectedArtwork} onChange={(event) => setSelectedArtwork(event.target.value)}>
              <option value="">Select an artwork</option>
              {artworks.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.name}</option>)}
            </select>
            <button type="submit" className="btn-secondary" disabled={!selectedArtwork}>Add frame</button>
          </form>
          {playingIndex >= 0 && playbackFrames[playingIndex]?.artwork && (
            <div className="story-playback">
              <ArtworkThumbnail
                cells={playbackFrames[playingIndex].artwork.cells}
                gridSize={playbackFrames[playingIndex].artwork.gridSize}
                backgroundColor={playbackFrames[playingIndex].artwork.backgroundColor}
              />
              <strong>{playbackFrames[playingIndex].artwork.name}</strong>
            </div>
          )}
          <ol className="story-frame-list">
            {frames.map((frame, index) => {
              const artwork = artworkById.get(frame.artworkId);
              return (
                <li
                  className={playingIndex === index ? "story-frame-active" : ""}
                  key={`${frame.artworkId}-${index}`}
                  draggable
                  onDragStart={() => setDraggedFrame(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); reorderFrames(draggedFrame, index); setDraggedFrame(-1); }}
                  onDragEnd={() => setDraggedFrame(-1)}
                >
                  <span className="story-frame-order">{index + 1}</span>
                  {artwork && <div className="story-frame-preview"><ArtworkThumbnail cells={artwork.cells} gridSize={artwork.gridSize} backgroundColor={artwork.backgroundColor} /></div>}
                  <strong>{artwork?.name || frame.artworkId}</strong>
                  <label>Duration (ms)<input type="number" min="20" max="10000" value={frame.durationMs} onChange={(event) => updateFrameDuration(index, event.target.value)} /></label>
                  <button className="btn-secondary" disabled={index === 0} onClick={() => moveFrame(index, -1)} aria-label="Move frame up">↑</button>
                  <button className="btn-secondary" disabled={index === frames.length - 1} onClick={() => moveFrame(index, 1)} aria-label="Move frame down">↓</button>
                  <button className="btn-artwork-delete" onClick={() => removeFrame(index)} aria-label="Remove frame"><i className="fa-solid fa-trash-can"></i></button>
                </li>
              );
            })}
          </ol>
          {hasUnsavedChanges && <p className="story-unsaved-note">Unsaved Story changes</p>}
        </section>
      )}
    </div>
  );
}
