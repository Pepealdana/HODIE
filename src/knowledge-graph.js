const KNOWLEDGE_TYPES = new Set(["vocabulary", "grammar", "function", "pronunciation", "expression", "example"]);

function buildKnowledgeGraph(matrix, microLibrary, contentLibrary, knowledgeLibrary) {
  const canDos = new Map((matrix?.canDos || []).map((item) => [item.id, item]));
  const microActivities = microLibrary?.activities || [];
  const contentActivities = contentLibrary?.activities || [];
  const nodes = knowledgeLibrary?.knowledge || [];
  const ids = new Set();
  const errors = [];
  const graphNodes = nodes.map((node) => {
    if (!node.id || ids.has(node.id)) errors.push(`Missing or duplicate knowledge id: ${node.id || "(empty)"}`);
    ids.add(node.id);
    if (!KNOWLEDGE_TYPES.has(node.type)) errors.push(`${node.id}: unsupported knowledge type "${node.type}"`);
    for (const canDoId of node.canDoIds || []) {
      if (!canDos.has(canDoId)) errors.push(`${node.id}: unknown Can-Do "${canDoId}"`);
    }
    return {
      ...node,
      canDos: (node.canDoIds || []).map((id) => canDos.get(id)).filter(Boolean),
      microActivityIds: microActivities.filter((activity) =>
        (node.canDoIds || []).includes(activity.canDoId) &&
        (node.resources || []).some((resource) =>
          activity.resources?.includes(resource) ||
          activity.languageResource === resource ||
          activity.skill === resource
        )
      ).map((activity) => activity.id),
      contentActivityIds: contentActivities.filter((activity) => {
        if (!(node.canDoIds || []).includes(activity.canDoId)) return false;
        const tags = (activity.metadata?.tags || []).map((tag) => String(tag).toLowerCase());
        const items = (node.items || []).map((item) => String(item).toLowerCase());
        return (node.resources || []).some((resource) => activity.resources?.includes(resource) || activity.languageResource === resource || activity.skill === resource) ||
          items.some((item) => tags.includes(item)) ||
          tags.some((tag) => (node.label + " " + (node.labelEs || "")).toLowerCase().includes(tag));
      }).map((activity) => activity.id)
    };
  });

  const nodeIds = new Set(graphNodes.map((node) => node.id));
  for (const node of graphNodes) {
    for (const dependency of node.dependsOn || []) {
      if (!nodeIds.has(dependency)) errors.push(`${node.id}: unknown dependency "${dependency}"`);
    }
  }

  return {
    schemaVersion: knowledgeLibrary?.schemaVersion || "1.0.0",
    nodes: graphNodes,
    errors,
    valid: errors.length === 0
  };
}

function getKnowledgeForCanDo(graph, canDoId) {
  return (graph?.nodes || []).filter((node) => node.canDoIds?.includes(canDoId));
}

function getKnowledgeForActivity(graph, activity) {
  if (!activity) return [];
  return (graph?.nodes || []).filter((node) =>
    node.canDoIds?.includes(activity.canDoId) &&
    (node.resources || []).some((resource) =>
      activity.resources?.includes(resource) ||
      activity.languageResource === resource ||
      activity.skill === resource
    )
  );
}

function validateKnowledgeGraph(graph) {
  const errors = [...(graph?.errors || [])];
  for (const node of graph?.nodes || []) {
    if (!(node.items || []).length) errors.push(`${node.id}: knowledge node has no examples or items`);
    if (!(node.transferTo || []).length) errors.push(`${node.id}: knowledge node has no transfer skills`);
  }
  return { valid: errors.length === 0, errors };
}

export { buildKnowledgeGraph, getKnowledgeForCanDo, getKnowledgeForActivity, validateKnowledgeGraph };
