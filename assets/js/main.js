const storageKey = "theme-preference";
const themeColors = {
  light: "#ffffff",
  dark: "#1c1815",
};

function getStoredTheme() {
  try {
    return localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
  } catch (error) {
    return "light";
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch (error) {
    return;
  }
}

function syncThemeToggle(theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = nextTheme === "dark" ? "Dark" : "Light";
    button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  });
}

function applyTheme(theme) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  const body = document.body;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);

  if (body) {
    body.classList.remove("light", "dark");
    body.classList.add(resolvedTheme);
  }

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColors[resolvedTheme]);
  }

  setStoredTheme(resolvedTheme);
  syncThemeToggle(resolvedTheme);
}

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getStoredTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const currentTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
  });
});
