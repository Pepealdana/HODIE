function getCanDos(matrix = {}) {
  return Array.isArray(matrix.canDos) ? matrix.canDos : [];
}

function buildSkillGraph(matrix = {}) {
  const canDos = getCanDos(matrix);
  const nodes = new Map(canDos.map((canDo) => [
    canDo.id,
    {
      id: canDo.id,
      skill: canDo.skill,
      level: canDo.level,
      prerequisites: [...(canDo.prerequisites || [])],
      next: []
    }
  ]));

  for (const node of nodes.values()) {
    for (const prerequisite of node.prerequisites) {
      const parent = nodes.get(prerequisite);
      if (parent) parent.next.push(node.id);
    }
  }

  return [...nodes.values()];
}

function getNode(graph, id) {
  return graph.find((node) => node.id === id) || null;
}

function getNextNodes(graph, id) {
  return getNode(graph, id)?.next.map((nextId) => getNode(graph, nextId)).filter(Boolean) || [];
}

function getPrerequisiteNodes(graph, id) {
  return getNode(graph, id)?.prerequisites.map((id) => getNode(graph, id)).filter(Boolean) || [];
}

export { buildSkillGraph, getNode, getNextNodes, getPrerequisiteNodes };
