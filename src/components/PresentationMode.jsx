import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSnapSvgData } from "../utils/snapSvg.mjs";

const DEFAULT_DURATION_MS = 1500;

const PresentationArtwork = memo(function PresentationArtwork({
  snap,
  transition,
  durationMs,
}) {
  const svgData = useMemo(() => createSnapSvgData(snap), [snap]);
  if (!svgData) {
    return <p className="presentation-invalid-snap">This snap cannot be displayed.</p>;
  }

  const pixels = transition === "pixel" ? svgData.pixels : null;
  const pixelAnimationMs = Math.max(80, Math.min(180, durationMs * 0.12));
  const pixelRevealMs = Math.min(900, durationMs * 0.6);

  return (
    <svg
      key={`${snap.id}-${transition}`}
      className={`presentation-art presentation-art--${transition}`}
      viewBox={svgData.viewBox}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${snap.title}, ${snap.gridSize} by ${snap.gridSize} pixel art`}
    >
      {svgData.backgroundFill && (
        <rect
          x="0"
          y="0"
          width={svgData.gridSize}
          height={svgData.gridSize}
          fill={svgData.backgroundFill}
        />
      )}
      {pixels
        ? pixels.map(
            (pixel) =>
              pixel && (
                <rect
                  key={pixel.index}
                  className="presentation-pixel"
                  x={pixel.x}
                  y={pixel.y}
                  width="1"
                  height="1"
                  fill={pixel.fill}
                  style={{
                    animationDelay: `${
                      (pixelRevealMs * pixel.index) /
                      Math.max(1, svgData.gridSize * svgData.gridSize - 1)
                    }ms`,
                    animationDuration: `${pixelAnimationMs}ms`,
                  }}
                />
              )
          )
        : svgData.rectangles.map((rectangle) => (
            <rect
              key={`${rectangle.x}-${rectangle.y}-${rectangle.width}-${rectangle.height}-${rectangle.fill}`}
              x={rectangle.x}
              y={rectangle.y}
              width={rectangle.width}
              height={rectangle.height}
              fill={rectangle.fill}
            />
          ))}
    </svg>
  );
});

export default function PresentationMode({
  snaps,
  startingSnapId,
  onExit,
}) {
  const [currentSnapId, setCurrentSnapId] = useState(
    () =>
      snaps.find((snap) => snap.id === startingSnapId)?.id ?? snaps[0]?.id ?? null
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [durationMs, setDurationMs] = useState(DEFAULT_DURATION_MS);
  const [transition, setTransition] = useState("fade");
  const [isLooping, setIsLooping] = useState(false);
  const [progress, setProgress] = useState(0);
  const exitButtonRef = useRef(null);
  const previousIndexRef = useRef(0);

  const currentIndex = snaps.findIndex((snap) => snap.id === currentSnapId);
  const currentSnap = currentIndex >= 0 ? snaps[currentIndex] : null;

  const changeSlide = useCallback(
    (direction) => {
      if (snaps.length === 0) return;
      const current = snaps.findIndex((snap) => snap.id === currentSnapId);
      const index = current < 0 ? 0 : current;
      let nextIndex = index + direction;

      if (isLooping) {
        nextIndex = (nextIndex + snaps.length) % snaps.length;
      } else {
        nextIndex = Math.max(0, Math.min(snaps.length - 1, nextIndex));
      }

      if (nextIndex !== index) {
        setCurrentSnapId(snaps[nextIndex].id);
        setProgress(0);
      }
    },
    [snaps, currentSnapId, isLooping]
  );

  useEffect(() => {
    if (snaps.length === 0) {
      onExit();
      return;
    }
    if (currentIndex >= 0) {
      previousIndexRef.current = currentIndex;
      return;
    }

    const fallbackIndex = Math.min(previousIndexRef.current, snaps.length - 1);
    setCurrentSnapId(snaps[fallbackIndex].id);
    setProgress(0);
  }, [snaps, currentIndex, onExit]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    exitButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Tab") {
        const focusable = document.querySelectorAll(
          ".presentation-overlay button:not(:disabled), .presentation-overlay input:not(:disabled), .presentation-overlay select:not(:disabled)"
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.matches("input, textarea, select"))
      ) {
        if (event.key === "Escape") exitButtonRef.current?.focus();
        else return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeSlide(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changeSlide(1);
      } else if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((playing) => !playing);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [changeSlide, onExit]);

  useEffect(() => {
    if (!isPlaying || !currentSnap || snaps.length === 0) return undefined;

    const startedAt = Date.now();
    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, (elapsed / durationMs) * 100));
    }, 40);

    const advanceTimer = window.setTimeout(() => {
      if (currentIndex < snaps.length - 1) {
        setCurrentSnapId(snaps[currentIndex + 1].id);
        setProgress(0);
      } else if (isLooping) {
        setCurrentSnapId(snaps[0].id);
        setProgress(0);
      } else {
        setProgress(100);
        setIsPlaying(false);
      }
    }, durationMs);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [
    isPlaying,
    currentSnap,
    currentIndex,
    snaps,
    durationMs,
    isLooping,
  ]);

  if (!currentSnap) return null;

  return (
    <section
      className="presentation-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="GridCraft presentation"
    >
      <header className="presentation-header">
        <div className="presentation-brand">
          <span className="presentation-brand-mark" aria-hidden="true">GC</span>
          <span>GRIDCRAFT <span>· PRESENTATION</span></span>
        </div>
        <div className="presentation-settings">
          <label>
            Slide duration
            <span className="presentation-input-wrap">
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={durationMs / 1000}
                onChange={(event) => {
                  const seconds = Number(event.target.value);
                  if (Number.isFinite(seconds)) {
                    setDurationMs(Math.max(500, Math.min(10000, seconds * 1000)));
                    setProgress(0);
                  }
                }}
                aria-label="Slide duration in seconds"
              />
              <span>sec</span>
            </span>
          </label>
          <label>
            Transition
            <select
              value={transition}
              onChange={(event) => setTransition(event.target.value)}
              aria-label="Slide transition"
            >
              <option value="cut">Instant cut</option>
              <option value="fade">Fade</option>
              <option value="pixel">Pixel reveal</option>
              <option value="wipe">Wipe</option>
            </select>
          </label>
          <label className="presentation-loop-setting">
            <input
              type="checkbox"
              checked={isLooping}
              onChange={(event) => setIsLooping(event.target.checked)}
            />
            Loop
          </label>
        </div>
        <button
          ref={exitButtonRef}
          type="button"
          className="presentation-exit-button"
          onClick={onExit}
          title="Exit presentation (Esc)"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
          <span>Exit</span>
        </button>
      </header>

      <main className="presentation-stage">
        <div className="presentation-canvas">
          <PresentationArtwork
            snap={currentSnap}
            transition={transition}
            durationMs={durationMs}
          />
        </div>
        <div className="presentation-slide-caption" aria-live="polite">
          <h1>{currentSnap.title}</h1>
          <span>
            {currentSnap.gridSize}×{currentSnap.gridSize}
          </span>
        </div>
      </main>

      <footer className="presentation-controls">
        <div className="presentation-progress">
          <div
            className="presentation-progress-track"
            role="progressbar"
            aria-label="Slide progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="presentation-slide-count" aria-live="polite">
            {currentIndex + 1} / {snaps.length}
          </span>
        </div>
        <div className="presentation-transport">
          <button
            type="button"
            onClick={() => changeSlide(-1)}
            disabled={!isLooping && currentIndex === 0}
            title="Previous slide (Left Arrow)"
            aria-label="Previous slide"
          >
            <i className="fa-solid fa-backward-step" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="presentation-play-button"
            onClick={() => {
              if (!isPlaying && progress >= 100) {
                setCurrentSnapId(snaps[0].id);
                setProgress(0);
              }
              setIsPlaying((playing) => !playing);
            }}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            aria-label={isPlaying ? "Pause presentation" : "Play presentation"}
          >
            <i
              className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => changeSlide(1)}
            disabled={!isLooping && currentIndex === snaps.length - 1}
            title="Next slide (Right Arrow)"
            aria-label="Next slide"
          >
            <i className="fa-solid fa-forward-step" aria-hidden="true" />
          </button>
        </div>
        <p className="presentation-shortcuts">
          ← → Navigate <span>·</span> Space Play / pause <span>·</span> Esc Exit
        </p>
      </footer>
    </section>
  );
}
