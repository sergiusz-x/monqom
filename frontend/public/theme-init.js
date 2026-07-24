(() => {
  const storedTheme = localStorage.getItem("monqom-theme");
  const legacyTheme = localStorage.getItem("monqom-dark-mode");
  const theme =
    storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
      ? storedTheme
      : legacyTheme === "true"
        ? "dark"
        : legacyTheme === "false"
          ? "light"
          : "system";
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
})();
