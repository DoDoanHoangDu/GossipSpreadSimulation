export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGraph(nodeIds, edges) {
  const graph = new Map(nodeIds.map((nodeId) => [nodeId, new Set()]));

  for (const [source, target] of edges) {
    if (source === target) {
      continue;
    }
    if (!graph.has(source)) {
      graph.set(source, new Set());
    }
    if (!graph.has(target)) {
      graph.set(target, new Set());
    }
    graph.get(source).add(target);
    graph.get(target).add(source);
  }

  return graph;
}

export function createSmallWorldGraph(
  nodeCount,
  meanDegree = 4,
  rewiringProbability = 0.18,
  random = Math.random,
) {
  const nodeIds = Array.from({ length: nodeCount }, (_, index) => index + 1);
  const graph = createGraph(nodeIds, []);
  const halfDegree = Math.max(1, Math.floor(meanDegree / 2));

  for (const source of nodeIds) {
    for (let offset = 1; offset <= halfDegree; offset += 1) {
      const originalTarget = ((source - 1 + offset) % nodeCount) + 1;
      let target = originalTarget;

      if (random() < rewiringProbability) {
        const candidates = nodeIds.filter(
          (candidate) => candidate !== source && !graph.get(source).has(candidate),
        );
        if (candidates.length > 0) {
          target = candidates[Math.floor(random() * candidates.length)];
        }
      }

      graph.get(source).add(target);
      graph.get(target).add(source);
    }
  }

  return graph;
}

export function createScaleFreeGraph(
  nodeCount,
  linksPerNode = 2,
  random = Math.random,
) {
  const initialSize = Math.min(nodeCount, linksPerNode + 1);
  const nodeIds = Array.from({ length: nodeCount }, (_, index) => index + 1);
  const graph = createGraph(nodeIds, []);

  for (let source = 1; source <= initialSize; source += 1) {
    for (let target = source + 1; target <= initialSize; target += 1) {
      graph.get(source).add(target);
      graph.get(target).add(source);
    }
  }

  for (let source = initialSize + 1; source <= nodeCount; source += 1) {
    const chosenTargets = new Set();
    while (chosenTargets.size < Math.min(linksPerNode, source - 1)) {
      const candidates = [];
      for (let target = 1; target < source; target += 1) {
        const weight = Math.max(1, graph.get(target).size);
        for (let index = 0; index < weight; index += 1) {
          candidates.push(target);
        }
      }
      chosenTargets.add(candidates[Math.floor(random() * candidates.length)]);
    }

    for (const target of chosenTargets) {
      graph.get(source).add(target);
      graph.get(target).add(source);
    }
  }

  return graph;
}

export function parseEdgeCsv(csvText) {
  const edges = [];
  const lines = csvText.trim().split(/\r?\n/);

  for (const line of lines.slice(1)) {
    const [sourceText, targetText] = line.replaceAll('"', "").split(",");
    const source = Number(sourceText);
    const target = Number(targetText);
    if (Number.isInteger(source) && Number.isInteger(target)) {
      edges.push([source, target]);
    }
  }

  const nodeIds = [...new Set(edges.flat())].sort((left, right) => left - right);
  return createGraph(nodeIds, edges);
}

export function getAvailableNodes(graph, source, hopCount = 1) {
  if (hopCount === 0) {
    return new Set([...graph.keys()].filter((nodeId) => nodeId !== source));
  }

  let current = new Set([source]);
  const visited = new Set([source]);
  const availableNodes = new Set();

  for (let hop = 0; hop < hopCount; hop += 1) {
    const nextLevel = new Set();
    for (const nodeId of current) {
      for (const neighbor of graph.get(nodeId) ?? []) {
        availableNodes.add(neighbor);
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextLevel.add(neighbor);
        }
      }
    }
    current = nextLevel;
    if (current.size === 0) {
      break;
    }
  }

  availableNodes.delete(source);
  return availableNodes;
}

function createFrame({
  round,
  reached,
  frontier,
  newlyReached,
  victimNeighbors,
  availableNodes,
  spreadTime,
}) {
  const reachedFriends = new Set(
    [...reached].filter((nodeId) => victimNeighbors.has(nodeId)),
  );
  return {
    round,
    reached: new Set(reached),
    frontier: new Set(frontier),
    newlyReached: new Set(newlyReached),
    reachedFriends,
    spreadFactor:
      victimNeighbors.size === 0 ? 0 : reachedFriends.size / victimNeighbors.size,
    totalFactor: availableNodes.size === 0 ? 0 : reached.size / availableNodes.size,
    spreadTime,
  };
}

export function simulateGossip({
  graph,
  victim,
  originator,
  hopCount = 1,
  probability = 1,
  random = Math.random,
}) {
  const availableNodes = getAvailableNodes(graph, victim, hopCount);
  if (!availableNodes.has(originator)) {
    throw new Error("Originator must be inside the focal person's neighborhood.");
  }

  const victimNeighbors = new Set(graph.get(victim) ?? []);
  const reached = new Set([originator]);
  let frontier = new Set([originator]);
  let spreadTime = 0;
  let round = 0;
  const frames = [
    createFrame({
      round,
      reached,
      frontier,
      newlyReached: frontier,
      victimNeighbors,
      availableNodes,
      spreadTime,
    }),
  ];

  while (frontier.size > 0) {
    const nextFrontier = new Set();
    for (const nodeId of frontier) {
      for (const neighbor of graph.get(nodeId) ?? []) {
        if (
          availableNodes.has(neighbor) &&
          !reached.has(neighbor) &&
          random() <= probability
        ) {
          reached.add(neighbor);
          nextFrontier.add(neighbor);
          if (victimNeighbors.has(neighbor)) {
            spreadTime = round + 1;
          }
        }
      }
    }

    round += 1;
    frames.push(
      createFrame({
        round,
        reached,
        frontier: nextFrontier,
        newlyReached: nextFrontier,
        victimNeighbors,
        availableNodes,
        spreadTime,
      }),
    );
    frontier = nextFrontier;
  }

  return {
    availableNodes,
    victimNeighbors,
    frames,
  };
}

export function graphEdges(graph) {
  const edges = [];
  for (const [source, neighbors] of graph) {
    for (const target of neighbors) {
      if (source < target) {
        edges.push([source, target]);
      }
    }
  }
  return edges;
}

export function shortestPathLevels(graph, source) {
  const levels = new Map([[source, 0]]);
  let frontier = [source];

  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const nodeId of frontier) {
      const level = levels.get(nodeId);
      for (const neighbor of graph.get(nodeId) ?? []) {
        if (!levels.has(neighbor)) {
          levels.set(neighbor, level + 1);
          nextFrontier.push(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return levels;
}
