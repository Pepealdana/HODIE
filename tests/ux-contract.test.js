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
assert.match(app, /const experienceFeedback = document\.querySelector\("#experienceFeedback"\)/);
assert.match(app, /function evaluateCurrent\(response\) \{\s*if \(!practice \|\| practice\.answered\) return;/);
assert.match(app, /practice\.answered = false;/);

console.log("HODIE UX contract: PASS");

assert.match(html, /name="google" content="notranslate"/);
assert.match(html, /translate="no"/);
assert.match(app, /learning-hints/);
assert.match(app, /experienceStopButton/);
assert.doesNotMatch(app, /What can I improve\?/);\nassert.match(app, /Add the missing key word/);\nassert.match(app, /Revise answer/);
assert.match(app, /activity\.pronunciationHint/);
console.log("HODIE learning-support and translation opt-out contract: PASS");
