import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const model = read("../data/content-model.json");
const library = read("../data/content-library.json");
const activityModel = read("../data/activity-model.json");
const matrix = read("../data/can-do-matrix.json");
const progress = read("../data/progress-model.json");

const required = model.activitySchema.required;
const activityTypes = new Set(activityModel.activityTypes.map((item) => item.id));
const canDos = new Map(matrix.canDos.map((item) => [item.id, item]));
const ids = new Set();
const validDimensions = progress.evidenceDimensions;
const errors = [];

for (const activity of library.activities) {
  if (ids.has(activity.id)) errors.push(`Duplicate activity id: ${activity.id}`);
  ids.add(activity.id);

  for (const field of required) {
    if (activity[field] === undefined || activity[field] === null) {
      errors.push(`${activity.id}: missing required field "${field}"`);
    }
  }

  const canDo = canDos.get(activity.canDoId);
  if (!canDo) {
    errors.push(`${activity.id}: unknown Can-Do "${activity.canDoId}"`);
  } else {
    if (activity.level !== canDo.level) errors.push(`${activity.id}: level does not match Can-Do`);
    if (activity.skill !== canDo.skill) errors.push(`${activity.id}: skill does not match Can-Do`);
  }

  if (!activityTypes.has(activity.activityType)) {
    errors.push(`${activity.id}: unknown activity type "${activity.activityType}"`);
  }

  const allowedDimensions = validDimensions[activity.skill] || [];
  for (const dimension of Object.keys(activity.evidence?.dimensions || {})) {
    if (!allowedDimensions.includes(dimension)) {
      errors.push(`${activity.id}: evidence dimension "${dimension}" is invalid for skill "${activity.skill}"`);
    }
  }

  if (!Array.isArray(activity.feedback?.languages) || !activity.feedback.languages.includes("en")) {
    errors.push(`${activity.id}: feedback must support English`);
  }
  if (activity.feedback?.maxPriorityCorrections === undefined) {
    errors.push(`${activity.id}: feedback.maxPriorityCorrections is required`);
  }
  if (activity.retry?.requiredAfterPriorityError !== true) {
    errors.push(`${activity.id}: retry.requiredAfterPriorityError must be true`);
  }
  if (activity.retry?.preserveOriginalTask !== true) {
    errors.push(`${activity.id}: retry.preserveOriginalTask must be true`);
  }
}

assert.equal(errors.length, 0, errors.join("\n"));

console.log(`HODIE Content Model validation: PASS (${library.activities.length} activities)`);
