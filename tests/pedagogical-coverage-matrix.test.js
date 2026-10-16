import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const canDo = read("../data/can-do-matrix.json");
const micro = read("../data/micro-practice-library.json").activities;
const full = read("../data/content-library.json").activities;
const blueprints = read("../data/linguistic-activity-blueprints.json");

const skills = canDo.skills;
const activities = [...micro, ...full];
const supportedLevels = ["A1", "A2", "B1", "B2"];
const stageFor = (activity) => {
  const type = activity.type || activity.activityType;
  if (["choose", "complete", "match", "order", "recognition", "controlled-practice"].includes(type)) return "recognition";
  if (["listening", "listening-comprehension", "reading-comprehension"].includes(type)) return "comprehension";
  if (["speak", "mini-production", "guided-production", "independent-production", "writing", "pronunciation"].includes(type)) return "production";
  if (["interaction", "simulation"].includes(type) || activity.skill === "communication") return "interaction";
  if (["integrated-task", "transfer"].includes(type)) return "transfer";
  return "other";
};
const countBy = (items, keyFn) => items.reduce((result, item) => {
  const key = keyFn(item);
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});
const skillCounts = countBy(activities, (x) => x.skill);
const skillModes = Object.fromEntries(skills.map((skill) => [
  skill,
  [...new Set(activities.filter((x) => x.skill === skill).map((x) => x.type || x.activityType))]
]));
const skillLevelCounts = countBy(activities, (x) => `${x.skill}|${x.level}`);
const skillStageCounts = countBy(activities, (x) => `${x.skill}|${x.level}|${stageFor(x)}`);
const minimum = Math.min(...skills.map((skill) => skillCounts[skill] || 0));
const maximum = Math.max(...skills.map((skill) => skillCounts[skill] || 0));
const imbalanceRatio = minimum ? maximum / minimum : Infinity;
const allSkillsHaveModeDiversity = skills.every((skill) => (skillModes[skill] || []).length >= 2);
const b1Complete = skills.every((skill) => (skillLevelCounts[`${skill}|B1`] || 0) >= 1);
const balancedEnoughForB2 = imbalanceRatio <= 8 && allSkillsHaveModeDiversity && b1Complete;
const b2Activities = activities.filter((x) => x.level === "B2");
const b2Validated = b2Activities.length > 0 && b2Activities.every((x) => x.validation?.status === "validated" && x.validation?.reviewedBy && x.evaluation?.observable === true);
const b2Eligible = balancedEnoughForB2 && b2Validated && b2Activities.length > 0;

// Core guardrails: content volume must represent all eight skills, not just the easiest-to-generate ones.
for (const skill of skills) {
  assert.ok((skillCounts[skill] || 0) >= 3, `${skill} needs at least 3 activities across micro and full banks`);
  assert.ok((skillLevelCounts[`${skill}|A2`] || 0) >= 1, `${skill} needs A2 coverage`);
  assert.ok((skillModes[skill] || []).length >= 2, `${skill} needs at least two activity modes`);
}
assert.ok(imbalanceRatio <= 10,
  `Skill coverage is too imbalanced (largest/smallest = ${imbalanceRatio.toFixed(1)}x). Strengthen underrepresented skills before expanding dominant ones.`);
for (const level of ["A1", "A2", "B1"]) {
  for (const skill of skills) {
    assert.ok((skillLevelCounts[`${skill}|${level}`] || 0) >= 3,
      `${level} ${skill} needs at least three activities before B2 is considered`);
  }
}
assert.equal(b2Activities.length, 0, "B2 must remain outside the active banks until the learner passes the readiness gate");
assert.ok(blueprints.categories.some((x) => x.id === "reading"), "Reading progression blueprint must remain available");
assert.ok(blueprints.categories.some((x) => x.id === "pronunciation"), "Pronunciation progression blueprint must remain available");

// Spiral coverage is intentionally explicit for skills that learners must revisit at
// foundation, consolidation, and transfer stages rather than treating A1 as mastered.
for (const skill of ["reading", "pronunciation", "communication"]) {
  for (const level of ["A1", "A2", "B1"]) {
    const matching = activities.filter((x) => x.skill === skill && x.level === level);
    assert.ok(matching.length >= 3,
      `${skill} needs at least 3 ${level} activities for spiral practice; found ${matching.length}`);
    const spiral = matching.filter((x) => x.spiralReview?.reviewableFrom?.includes(level));
    assert.ok(spiral.length >= 3,
      `${skill} ${level} needs at least 3 explicitly tagged spiral-review activities; found ${spiral.length}`);
  }
}
for (const [advancedId, foundationId] of [
  ["RE-A2-01", "RE-A1-01"],
  ["RE-B1-01", "RE-A1-01"],
  ["PR-A2-01", "PR-A1-01"],
  ["PR-B1-01", "PR-A1-01"],
  ["CO-A2-01", "CO-A1-01"],
  ["CO-B1-01", "CO-A1-01"]
]) {
  const advanced = canDo.canDos.find((x) => x.id === advancedId);
  assert.ok(advanced?.recovery?.includes(foundationId),
    `${advancedId} must offer recovery through ${foundationId} instead of assuming foundation mastery`);
}
for (const id of ["RE-A1-01", "PR-A1-01", "CO-A1-01"]) {
  assert.ok(canDo.canDos.some((x) => x.id === id), `Missing foundational A1 Can-Do: ${id}`);
}

// B2 must not be enabled merely because blueprints mention it. Require validated B2 tasks,
// full B1 skill coverage, multiple modes per skill, and a tighter balance threshold.
assert.ok(b2Activities.length === 0 || b2Eligible,
  "B2 activities require validated review metadata and balanced coverage across all skills.");

const missingSkillLevels = [];
for (const skill of skills) {
  for (const level of supportedLevels) {
    if (!(skillLevelCounts[`${skill}|${level}`] || 0)) missingSkillLevels.push(`${skill}|${level}`);
  }
}
const missingSkillStages = [];
for (const skill of skills) {
  for (const level of ["A2", "B1"]) {
    for (const stage of ["recognition", "comprehension", "production", "interaction", "transfer"]) {
      if (!(skillStageCounts[`${skill}|${level}|${stage}`] || 0)) missingSkillStages.push(`${skill}|${level}|${stage}`);
    }
  }
}

console.log("HODIE pedagogical coverage matrix: PASS", JSON.stringify({
  totalActivities: activities.length,
  skills: Object.fromEntries(skills.map((skill) => [skill, { count: skillCounts[skill] || 0, modes: skillModes[skill] }])),
  imbalanceRatio: Number(imbalanceRatio.toFixed(2)),
  b1Complete,
  b2Eligible,
  b2GateReasons: [
    ...(b1Complete ? [] : ["B1 does not yet cover all eight skills"]),
    ...(imbalanceRatio <= 8 ? [] : ["skill distribution must be more balanced (maximum ratio 8x)"]),
    ...(allSkillsHaveModeDiversity ? [] : ["each skill needs multiple activity modes"]),
    ...(b2Validated ? [] : ["B2 tasks need explicit validation metadata and observable evaluation"])
  ],
  missingSkillLevels,
  missingSkillStages
}, null, 2));
