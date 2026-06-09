// Tiny localStorage wrapper — the repo's first use of persistence.
// Swallows errors so private-mode / disabled-storage never breaks the app.

export function readStored(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore — persistence is best-effort
  }
}
