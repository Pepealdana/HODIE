import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(html, /id="app"/);
assert.match(html, /id="installPrompt"/);
assert.match(html, /id="themeToggle"/);
assert.match(html, /hodie-theme-v1/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\[data-theme="dark"\]/);
assert.match(css, /\.recommended-learning/);
assert.match(css, /\.answer-button/);
assert.match(app, /recommendedLearningButton/);
assert.match(app, /function applyTheme\(theme\)/);
assert.match(app, /THEME_KEY/);
assert.match(app, /resumePracticeButton/);
assert.match(app, /startExperience/);

console.log("HODIE UX contract: PASS");
