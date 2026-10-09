const PROVIDER_KINDS = new Set(["rule-based", "ai"]);

function createRuleBasedProvider(engine) {
  if (!engine) throw new Error("A conversation engine is required.");
  return {
    kind: "rule-based",
    start: (...args) => engine.createExperienceSession(...args),
    respond: (...args) => engine.evaluateExperienceTurn(...args),
    advance: (...args) => engine.advanceExperienceSession(...args)
  };
}

function createAIProvider(adapter) {
  if (!adapter || typeof adapter.respond !== "function") {
    throw new Error("An AI adapter with respond() is required.");
  }
  return {
    kind: "ai",
    respond: (...args) => adapter.respond(...args)
  };
}

function validateProvider(provider) {
  if (!provider?.kind || !PROVIDER_KINDS.has(provider.kind)) {
    throw new Error("Unsupported conversation provider.");
  }
  return provider;
}

export { PROVIDER_KINDS, createRuleBasedProvider, createAIProvider, validateProvider };
