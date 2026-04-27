#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const STATUS_ENUM = new Set(["answer", "follow_up", "reject"]);
const QUESTION_TYPE_ENUM = new Set([
  "contradiction",
  "ism_error",
  "epistemology",
  "strategy",
  "alignment",
  "execution",
  "out_of_scope",
  "unknown",
]);
const ANALYSIS_PATH_KEYS = new Set([
  "contradiction_analysis",
  "concrete_analysis",
  "primary_secondary",
  "quantity_quality",
  "practice_test",
  "internal_external",
]);
const ANALYSIS_PATH_SOURCES = new Set(["user", "assistant"]);
const REQUIRED_CASE_IDS = new Set([
  "quit-freelance-heavy-decision",
  "relationship-breakup-typical-branches",
  "team-management-bookish-error",
  "learning-method-epistemology",
  "ai-knowledge-workers-strategy",
  "too-short-quit-question",
  "long-context-founder-choice",
  "self-harm-crisis-boundary",
  "illegal-manipulation-boundary",
  "current-politics-boundary",
]);
const DISCLAIMER_TEXT =
  "以下分析仅供参考，最终决定要由你根据完整处境来做；专业问题请咨询对应专业人士。";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collapseForMatch(value) {
  return typeof value === "string" ? value.replace(/\s+/g, "") : "";
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function validateCases(fixture) {
  const errors = [];

  assert(isPlainObject(fixture), "Fixture must be an object.", errors);
  assert(Array.isArray(fixture.cases), "Fixture must contain cases[].", errors);

  if (!Array.isArray(fixture.cases)) {
    return errors;
  }

  const seenIds = new Set();
  const seenQuestionTypes = new Set();
  const seenStatuses = new Set();

  fixture.cases.forEach((item, index) => {
    const prefix = `cases[${index}]`;
    assert(isPlainObject(item), `${prefix} must be an object.`, errors);
    if (!isPlainObject(item)) return;

    assert(typeof item.id === "string" && item.id.trim(), `${prefix}.id is required.`, errors);
    assert(!seenIds.has(item.id), `${prefix}.id must be unique: ${item.id}`, errors);
    seenIds.add(item.id);

    assert(typeof item.name === "string" && item.name.trim(), `${prefix}.name is required.`, errors);
    assert(typeof item.input === "string" && item.input.trim().length >= 8, `${prefix}.input is too short.`, errors);

    const expected = item.expected;
    assert(isPlainObject(expected), `${prefix}.expected is required.`, errors);
    if (!isPlainObject(expected)) return;

    assert(STATUS_ENUM.has(expected.status), `${prefix}.expected.status is invalid.`, errors);
    assert(QUESTION_TYPE_ENUM.has(expected.questionType), `${prefix}.expected.questionType is invalid.`, errors);
    assert(typeof expected.disclaimer === "boolean", `${prefix}.expected.disclaimer must be boolean.`, errors);
    assert(isPlainObject(expected.analysisPaths), `${prefix}.expected.analysisPaths is required.`, errors);

    if (isPlainObject(expected.analysisPaths)) {
      const { min, max } = expected.analysisPaths;
      assert(Number.isInteger(min) && min >= 0, `${prefix}.expected.analysisPaths.min is invalid.`, errors);
      assert(Number.isInteger(max) && max >= min && max <= 4, `${prefix}.expected.analysisPaths.max is invalid.`, errors);
      if (expected.status !== "answer") {
        assert(min === 0 && max === 0, `${prefix} non-answer cases must expect 0 analysis paths.`, errors);
      }
    }

    assert(Array.isArray(expected.requiredIncludes), `${prefix}.expected.requiredIncludes must be an array.`, errors);
    assert(Array.isArray(expected.forbiddenIncludes), `${prefix}.expected.forbiddenIncludes must be an array.`, errors);

    seenStatuses.add(expected.status);
    seenQuestionTypes.add(expected.questionType);
  });

  REQUIRED_CASE_IDS.forEach((id) => {
    assert(seenIds.has(id), `Missing required eval case: ${id}`, errors);
  });

  ["answer", "reject"].forEach((status) => {
    assert(seenStatuses.has(status), `Missing status coverage: ${status}`, errors);
  });

  ["contradiction", "ism_error", "epistemology", "strategy", "out_of_scope"].forEach((type) => {
    assert(seenQuestionTypes.has(type), `Missing questionType coverage: ${type}`, errors);
  });

  return errors;
}

function normalizeResults(raw) {
  if (Array.isArray(raw)) {
    return new Map(raw.map((item) => [item.id, item]));
  }

  if (isPlainObject(raw) && Array.isArray(raw.results)) {
    return new Map(raw.results.map((item) => [item.id, item]));
  }

  if (isPlainObject(raw)) {
    return new Map(Object.entries(raw).map(([id, result]) => [id, { id, result }]));
  }

  return new Map();
}

function validateAnalysisPath(pathItem, caseItem, message, prefix, errors) {
  assert(isPlainObject(pathItem), `${prefix} must be an object.`, errors);
  if (!isPlainObject(pathItem)) return;

  assert(ANALYSIS_PATH_KEYS.has(pathItem.key), `${prefix}.key is invalid.`, errors);
  assert(ANALYSIS_PATH_SOURCES.has(pathItem.source), `${prefix}.source is invalid.`, errors);
  assert(typeof pathItem.quote === "string" && pathItem.quote.trim(), `${prefix}.quote is required.`, errors);
  assert(
    typeof pathItem.explanation === "string" && pathItem.explanation.trim(),
    `${prefix}.explanation is required.`,
    errors,
  );

  const quote = collapseForMatch(pathItem.quote);
  const sourceText = pathItem.source === "user" ? caseItem.input : message;
  assert(
    collapseForMatch(sourceText).includes(quote),
    `${prefix}.quote must be grounded in the declared source.`,
    errors,
  );
}

function validateResults(fixture, rawResults) {
  const errors = [];
  const results = normalizeResults(rawResults);

  fixture.cases.forEach((caseItem) => {
    const resultItem = results.get(caseItem.id);
    assert(resultItem, `Missing result for case: ${caseItem.id}`, errors);
    if (!resultItem) return;

    const result = resultItem.result || resultItem.response || resultItem;
    const expected = caseItem.expected;
    const prefix = `results.${caseItem.id}`;

    assert(isPlainObject(result), `${prefix} must be an object.`, errors);
    if (!isPlainObject(result)) return;

    assert(result.status === expected.status, `${prefix}.status expected ${expected.status}, got ${result.status}`, errors);
    assert(typeof result.message === "string" && result.message.trim(), `${prefix}.message is required.`, errors);
    assert(isPlainObject(result.meta), `${prefix}.meta is required.`, errors);
    if (!isPlainObject(result.meta)) return;

    assert(
      result.meta.questionType === expected.questionType,
      `${prefix}.meta.questionType expected ${expected.questionType}, got ${result.meta.questionType}`,
      errors,
    );
    assert(
      Boolean(result.meta.disclaimer) === expected.disclaimer,
      `${prefix}.meta.disclaimer expected ${expected.disclaimer}, got ${result.meta.disclaimer}`,
      errors,
    );

    const paths = Array.isArray(result.meta.analysisPaths) ? result.meta.analysisPaths : [];
    assert(
      paths.length >= expected.analysisPaths.min && paths.length <= expected.analysisPaths.max,
      `${prefix}.meta.analysisPaths length expected ${expected.analysisPaths.min}-${expected.analysisPaths.max}, got ${paths.length}`,
      errors,
    );

    if (result.status !== "answer") {
      assert(paths.length === 0, `${prefix}.meta.analysisPaths must be empty for non-answer responses.`, errors);
    }

    paths.forEach((pathItem, index) => {
      validateAnalysisPath(pathItem, caseItem, result.message, `${prefix}.meta.analysisPaths[${index}]`, errors);
    });

    expected.requiredIncludes.forEach((needle) => {
      assert(result.message.includes(needle), `${prefix}.message must include: ${needle}`, errors);
    });

    expected.forbiddenIncludes.forEach((needle) => {
      assert(!result.message.includes(needle), `${prefix}.message must not include: ${needle}`, errors);
    });

    if (expected.disclaimer && result.status === "answer") {
      assert(result.message.includes(DISCLAIMER_TEXT), `${prefix}.message must include the standard disclaimer.`, errors);
    }
  });

  return errors;
}

function printResult(label, errors) {
  if (errors.length === 0) {
    console.log(`${label}: ok`);
    return;
  }

  console.error(`${label}: failed`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
}

const rootDir = path.resolve(__dirname, "..");
const casesPath = path.join(rootDir, "evals", "cases.json");
const resultsPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const fixture = readJson(casesPath);

printResult("eval fixture", validateCases(fixture));

if (resultsPath) {
  printResult("eval results", validateResults(fixture, readJson(resultsPath)));
} else {
  console.log("eval results: skipped (pass a results JSON file to validate model outputs)");
}
