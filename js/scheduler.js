// Render scheduler — inverts the business→renderer dependency.
//
// Business modules (controller, gesture, voice, voiceprint, gestureCamera) call
// markDirty() to signal "state changed; the UI should refresh" WITHOUT importing
// the renderer. The composition root (app.js) wires the actual render functions
// in via configureRenderer(). Renders are coalesced with requestAnimationFrame
// so a burst of state changes paints once per frame.
//
// Scopes:
//   "full"    — full re-render (default).
//   "runtime" — lightweight device-runtime render that updates sliders in place
//               (used while a slider is being dragged, so the dragged element is
//               not torn down and rebuilt).
// "full" always supersedes a pending "runtime" within the same frame.

let renderers = null;
let scheduled = false;
let pendingScope = "runtime";

const raf =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16);

export function configureRenderer(fns) {
  renderers = fns;
}

export function markDirty(scope = "full") {
  // No renderer wired (e.g. unit tests run under Node) — nothing to schedule.
  if (!renderers) return;

  if (scope === "full") pendingScope = "full";

  if (scheduled) return;
  scheduled = true;
  raf(flush);
}

// Render synchronously right now (used for the very first paint at startup).
export function renderNow(scope = "full") {
  if (!renderers) return;
  (renderers[scope] || renderers.full)();
}

function flush() {
  scheduled = false;
  const scope = pendingScope;
  pendingScope = "runtime";
  if (!renderers) return;
  (renderers[scope] || renderers.full)();
}
