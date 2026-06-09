import { renderIconElements } from "./renderer.js";
import { readStored, writeStored } from "./storage.js";

// Hero intro band: collapse/expand with persistence + "进入控制台" smooth scroll.
// Runs entirely outside the state/render pipeline — pure DOM class toggling.

const STORAGE_KEY = "vvcs-hero-collapsed";

export function initHero() {
  const hero = document.getElementById("hero");
  if (!hero) return;

  // Hydrate hero icons (idempotent — guarded by dataset.rendered).
  renderIconElements(hero);

  const collapseButton = document.getElementById("heroCollapseButton");
  const enterButton = document.getElementById("heroEnterButton");
  const toggleButton = document.getElementById("toggleHeroButton");

  // Restore prior preference (repeat visitors start collapsed).
  if (readStored(STORAGE_KEY) === "true") {
    setCollapsed(hero, collapseButton, true);
  }

  collapseButton?.addEventListener("click", () => {
    const next = !hero.classList.contains("collapsed");
    setCollapsed(hero, collapseButton, next);
    writeStored(STORAGE_KEY, String(next));
  });

  // Topbar toggle stays reachable even when the hero is collapsed
  // (the in-hero collapse button is not clickable once collapsed).
  toggleButton?.addEventListener("click", () => {
    const next = !hero.classList.contains("collapsed");
    setCollapsed(hero, collapseButton, next);
    writeStored(STORAGE_KEY, String(next));
    if (!next) hero.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  enterButton?.addEventListener("click", () => {
    setCollapsed(hero, collapseButton, true);
    writeStored(STORAGE_KEY, "true");
    scrollToDashboard();
  });
}

function setCollapsed(hero, button, collapsed) {
  hero.classList.toggle("collapsed", collapsed);
  if (button) {
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "展开介绍" : "收起介绍");
    button.title = collapsed ? "展开介绍" : "收起介绍";
  }
}

function scrollToDashboard() {
  const dashboard = document.querySelector(".dashboard");
  if (!dashboard) return;
  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  dashboard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
