import {
  createApollonianGraph,
  createErdosRenyiGraph,
  createScaleFreeGraph,
  createSeededRandom,
  createSmallWorldGraph,
  graphEdges,
  parseEdgeCsv,
  shortestPathLevels,
  simulateGossip,
} from "./simulation.mjs";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const AUTO_PLAY_DELAY_MS = 420;
const PLAYBACK_BASE_DELAY_MS = 1620;
const NETWORK_LABELS = {
  apollonian: "Apollonian network",
  "erdos-renyi": "Erdős–Rényi random network",
  "small-world": "Small-world network",
  "scale-free": "Scale-free network",
  school: "School community 01",
};

const elements = {
  networkModel: document.querySelector("#network-model"),
  nodeCount: document.querySelector("#node-count"),
  nodeCountOutput: document.querySelector("#node-count-output"),
  networkDensityField: document.querySelector("#network-density-field"),
  networkDensity: document.querySelector("#network-density"),
  networkDensityOutput: document.querySelector("#network-density-output"),
  hopCount: document.querySelector("#hop-count"),
  probability: document.querySelector("#probability"),
  probabilityOutput: document.querySelector("#probability-output"),
  victimSelect: document.querySelector("#victim-select"),
  originatorSelect: document.querySelector("#originator-select"),
  seed: document.querySelector("#seed"),
  regenerateButton: document.querySelector("#regenerate-button"),
  networkTitle: document.querySelector("#network-title"),
  graph: document.querySelector("#network-graph"),
  scopeRings: document.querySelector("#scope-rings"),
  edges: document.querySelector("#edges"),
  nodes: document.querySelector("#nodes"),
  graphMessage: document.querySelector("#graph-message"),
  autoRun: document.querySelector("#auto-run"),
  resetButton: document.querySelector("#reset-button"),
  stepButton: document.querySelector("#step-button"),
  playButton: document.querySelector("#play-button"),
  playLabel: document.querySelector("#play-label"),
  speed: document.querySelector("#speed"),
  roundValue: document.querySelector("#round-value"),
  spreadFactor: document.querySelector("#spread-factor"),
  spreadMeter: document.querySelector("#spread-meter"),
  spreadDetail: document.querySelector("#spread-detail"),
  totalReach: document.querySelector("#total-reach"),
  reachDetail: document.querySelector("#reach-detail"),
  spreadTime: document.querySelector("#spread-time"),
  curveTotal: document.querySelector("#curve-total"),
  chartGrid: document.querySelector("#chart-grid"),
  chartArea: document.querySelector("#chart-area"),
  chartLine: document.querySelector("#chart-line"),
  chartPoints: document.querySelector("#chart-points"),
  simulationStatus: document.querySelector("#simulation-status"),
  eventLog: document.querySelector("#event-log"),
};

const state = {
  graph: new Map(),
  positions: new Map(),
  victim: 1,
  originator: 2,
  result: null,
  frameIndex: 0,
  timer: null,
  autoTimer: null,
  loading: false,
};

function svgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function setRangeProgress(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const value = Number(input.value);
  const progress = ((value - minimum) / (maximum - minimum)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function highestDegreeNode(graph) {
  return [...graph.entries()].sort(
    ([leftId, leftNeighbors], [rightId, rightNeighbors]) =>
      rightNeighbors.size - leftNeighbors.size || leftId - rightId,
  )[0][0];
}

function bestOriginator(graph, victim) {
  const neighbors = [...(graph.get(victim) ?? [])];
  return neighbors.sort(
    (left, right) =>
      (graph.get(right)?.size ?? 0) - (graph.get(left)?.size ?? 0) || left - right,
  )[0];
}

function updateModelControls() {
  const model = elements.networkModel.value;
  elements.nodeCount.disabled = model === "school";
  elements.networkDensityField.hidden = model !== "erdos-renyi";
}

function populateNodeSelections() {
  const nodeIds = [...state.graph.keys()].sort((left, right) => left - right);
  elements.victimSelect.replaceChildren(
    ...nodeIds.map((nodeId) => new Option(`#${nodeId}`, String(nodeId))),
  );
  elements.victimSelect.value = String(state.victim);
  populateOriginators();
}

function populateOriginators() {
  const neighbors = [...(state.graph.get(state.victim) ?? [])].sort(
    (left, right) => left - right,
  );
  if (!neighbors.includes(state.originator)) {
    state.originator = bestOriginator(state.graph, state.victim);
  }
  elements.originatorSelect.replaceChildren(
    ...neighbors.map((nodeId) => new Option(`#${nodeId}`, String(nodeId))),
  );
  elements.originatorSelect.value = String(state.originator);
}

async function loadGraph() {
  stopPlayback();
  state.loading = true;
  elements.graphMessage.hidden = false;
  elements.graphMessage.textContent = "Building social network…";
  elements.regenerateButton.disabled = true;

  try {
    const model = elements.networkModel.value;
    const nodeCount = Number(elements.nodeCount.value);
    const seed = Number(elements.seed.value);
    const random = createSeededRandom(seed);

    if (model === "school") {
      const response = await fetch("../addhealth_edges/comm_01.csv");
      if (!response.ok) {
        throw new Error("The school network data could not be loaded.");
      }
      state.graph = parseEdgeCsv(await response.text());
    } else if (model === "apollonian") {
      state.graph = createApollonianGraph(nodeCount);
    } else if (model === "erdos-renyi") {
      state.graph = createErdosRenyiGraph(
        nodeCount,
        Number(elements.networkDensity.value) / 100,
        random,
      );
    } else if (model === "scale-free") {
      state.graph = createScaleFreeGraph(nodeCount, 2, random);
    } else {
      state.graph = createSmallWorldGraph(nodeCount, 4, 0.2, random);
    }

    if (graphEdges(state.graph).length === 0) {
      throw new Error(
        "The generated network has no edges. Increase density or change seed.",
      );
    }

    state.victim = highestDegreeNode(state.graph);
    state.originator = bestOriginator(state.graph, state.victim);
    elements.networkTitle.textContent = NETWORK_LABELS[model];
    populateNodeSelections();
    prepareSimulation();
  } catch (error) {
    elements.graphMessage.hidden = false;
    elements.graphMessage.textContent =
      error instanceof Error ? error.message : "The network could not be loaded.";
  } finally {
    state.loading = false;
    elements.regenerateButton.disabled = false;
  }
}

function prepareSimulation() {
  stopPlayback();
  const random = createSeededRandom(Number(elements.seed.value) + 97);
  state.result = simulateGossip({
    graph: state.graph,
    victim: state.victim,
    originator: state.originator,
    hopCount: Number(elements.hopCount.value),
    probability: Number(elements.probability.value) / 100,
    random,
  });
  state.frameIndex = 0;
  state.positions = createRadialPositions(state.graph, state.victim);
  elements.graphMessage.hidden = true;
  renderGraph();
  renderFrame();
  scheduleAutoPlayback();
}

function createRadialPositions(graph, centerNode) {
  const width = 900;
  const height = 580;
  const centerX = width / 2;
  const centerY = height / 2;
  const levels = shortestPathLevels(graph, centerNode);
  const nodesByLevel = new Map();

  for (const nodeId of graph.keys()) {
    const level = levels.get(nodeId) ?? Math.max(...levels.values()) + 1;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level).push(nodeId);
  }

  const maxLevel = Math.max(1, ...nodesByLevel.keys());
  const radiusStep = Math.min(105, 255 / maxLevel);
  const positions = new Map([[centerNode, { x: centerX, y: centerY, level: 0 }]]);

  for (const [level, nodeIds] of nodesByLevel) {
    if (level === 0) {
      continue;
    }
    nodeIds.sort((left, right) => left - right);
    const radius = Math.max(84, level * radiusStep);
    const angleOffset = (level * 0.71 + (centerNode % 7) * 0.13) % (Math.PI * 2);
    nodeIds.forEach((nodeId, index) => {
      const angle = angleOffset + (index / nodeIds.length) * Math.PI * 2;
      const ripple = ((nodeId * 17) % 13) - 6;
      positions.set(nodeId, {
        x: centerX + Math.cos(angle) * (radius + ripple),
        y: centerY + Math.sin(angle) * (radius + ripple * 0.55),
        level,
      });
    });
  }

  return positions;
}

function renderScopeRings() {
  const visibleLevels = [
    ...new Set(
      [...state.result.availableNodes]
        .map((nodeId) => state.positions.get(nodeId)?.level)
        .filter((level) => level > 0),
    ),
  ].sort((left, right) => left - right);

  elements.scopeRings.replaceChildren(
    ...visibleLevels.map((level) => {
      const nodeAtLevel = [...state.positions.values()].find(
        (position) => position.level === level,
      );
      const radius = nodeAtLevel
        ? Math.hypot(nodeAtLevel.x - 450, nodeAtLevel.y - 290)
        : 84;
      const ring = svgElement("circle", {
        class: "scope-ring",
        cx: 450,
        cy: 290,
        r: radius,
      });
      return ring;
    }),
  );

  if (visibleLevels.length > 0) {
    const firstLevelPosition = [...state.positions.values()].find(
      (position) => position.level === visibleLevels[0],
    );
    const firstRadius = firstLevelPosition
      ? Math.hypot(firstLevelPosition.x - 450, firstLevelPosition.y - 290)
      : 84;
    const label = svgElement("text", {
      class: "scope-label",
      x: 462,
      y: 290 - firstRadius + 5,
    });
    label.textContent =
      Number(elements.hopCount.value) === 0 ? "GLOBAL SCOPE" : "RUMOR SCOPE";
    elements.scopeRings.append(label);
  }
}

function renderGraph() {
  renderScopeRings();
  elements.edges.replaceChildren();
  elements.nodes.replaceChildren();

  for (const [source, target] of graphEdges(state.graph)) {
    const sourcePosition = state.positions.get(source);
    const targetPosition = state.positions.get(target);
    const line = svgElement("line", {
      class: "edge",
      "data-source": source,
      "data-target": target,
      x1: sourcePosition.x,
      y1: sourcePosition.y,
      x2: targetPosition.x,
      y2: targetPosition.y,
    });
    elements.edges.append(line);
  }

  for (const [nodeId, position] of state.positions) {
    const group = svgElement("g", {
      class: "node-group",
      "data-node-id": nodeId,
      role: "button",
      tabindex: "0",
      "aria-label": `Person ${nodeId}`,
      transform: `translate(${position.x} ${position.y})`,
    });
    group.append(
      svgElement("circle", { class: "node-hit", r: 15 }),
      svgElement("circle", { class: "node-core", r: 5.5 }),
    );
    if (
      nodeId === state.victim ||
      nodeId === state.originator ||
      state.graph.get(nodeId).size >= 10
    ) {
      const label = svgElement("text", {
        class: "node-label",
        y: nodeId === state.victim ? 3 : -10,
      });
      label.textContent = nodeId === state.victim ? `#${nodeId}` : String(nodeId);
      group.append(label);
    }
    group.addEventListener("click", () => selectNode(nodeId));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNode(nodeId);
      }
    });
    elements.nodes.append(group);
  }
}

function selectNode(nodeId) {
  if (nodeId === state.victim) {
    return;
  }

  if (state.graph.get(state.victim)?.has(nodeId)) {
    state.originator = nodeId;
  } else {
    state.victim = nodeId;
    state.originator = bestOriginator(state.graph, state.victim);
  }
  populateNodeSelections();
  prepareSimulation();
}

function currentFrame() {
  return state.result.frames[state.frameIndex];
}

function renderFrame() {
  const frame = currentFrame();
  const isComplete = state.frameIndex === state.result.frames.length - 1;
  const available = state.result.availableNodes;

  for (const line of elements.edges.children) {
    const source = Number(line.dataset.source);
    const target = Number(line.dataset.target);
    const bothInside = available.has(source) && available.has(target);
    const bothReached = frame.reached.has(source) && frame.reached.has(target);
    const isHot =
      bothReached &&
      (frame.newlyReached.has(source) || frame.newlyReached.has(target));
    line.setAttribute(
      "class",
      [
        "edge",
        bothInside ? "inside" : "outside",
        bothReached ? "reached" : "",
        isHot ? "hot" : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  for (const group of elements.nodes.children) {
    const nodeId = Number(group.dataset.nodeId);
    const classes = ["node-group"];
    if (nodeId === state.victim) {
      classes.push("victim");
    } else if (nodeId === state.originator) {
      classes.push("originator");
    } else if (!available.has(nodeId)) {
      classes.push("outside");
    } else if (frame.frontier.has(nodeId)) {
      classes.push("frontier");
    } else if (frame.reached.has(nodeId)) {
      classes.push("reached");
    }
    group.setAttribute("class", classes.join(" "));
    group.querySelector(".node-pulse")?.remove();
    if (frame.newlyReached.has(nodeId)) {
      group.prepend(svgElement("circle", { class: "node-pulse", r: 8 }));
    }
  }

  elements.roundValue.textContent = String(frame.round).padStart(2, "0");
  elements.spreadFactor.textContent = `${Math.round(frame.spreadFactor * 100)}%`;
  elements.spreadMeter.style.width = `${frame.spreadFactor * 100}%`;
  elements.spreadDetail.textContent =
    `${frame.reachedFriends.size} of ${state.result.victimNeighbors.size} ` +
    "direct friends reached";
  elements.totalReach.textContent = `${Math.round(frame.totalFactor * 100)}%`;
  elements.reachDetail.textContent =
    `${frame.reached.size} of ${state.result.availableNodes.size} people`;
  elements.spreadTime.textContent = String(frame.spreadTime);
  elements.curveTotal.textContent = String(frame.reached.size);

  elements.stepButton.disabled = isComplete;
  elements.playButton.disabled = isComplete;
  elements.simulationStatus.textContent = isComplete
    ? "Complete"
    : state.timer
      ? "Running"
      : "Ready";
  elements.simulationStatus.classList.toggle("complete", isComplete);
  renderChart();
  renderEventLog();

  if (isComplete) {
    stopPlayback();
    elements.playButton.disabled = true;
  }
}

function renderChart() {
  const frames = state.result.frames.slice(0, state.frameIndex + 1);
  const width = 300;
  const height = 132;
  const padding = { top: 10, right: 7, bottom: 12, left: 7 };
  const maximum = Math.max(state.result.availableNodes.size, 1);
  const totalRounds = Math.max(state.result.frames.length - 1, 1);

  const points = frames.map((frame) => ({
    x:
      padding.left +
      (frame.round / totalRounds) * (width - padding.left - padding.right),
    y:
      height -
      padding.bottom -
      (frame.reached.size / maximum) * (height - padding.top - padding.bottom),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${points.at(-1).x} ${height - padding.bottom} ` +
    `L ${points[0].x} ${height - padding.bottom} Z`;

  elements.chartLine.setAttribute("d", linePath);
  elements.chartArea.setAttribute("d", areaPath);
  elements.chartGrid.replaceChildren(
    ...[0.25, 0.5, 0.75, 1].map((ratio) =>
      svgElement("line", {
        class: "chart-grid-line",
        x1: padding.left,
        x2: width - padding.right,
        y1: padding.top + ratio * (height - padding.top - padding.bottom),
        y2: padding.top + ratio * (height - padding.top - padding.bottom),
      }),
    ),
  );
  elements.chartPoints.replaceChildren(
    ...points.map((point) =>
      svgElement("circle", {
        class: "chart-point",
        cx: point.x,
        cy: point.y,
        r: 2.8,
      }),
    ),
  );
}

function renderEventLog() {
  const frames = state.result.frames.slice(0, state.frameIndex + 1).reverse();
  const entries = frames.slice(0, 4).map((frame) => {
    const item = document.createElement("li");
    const round = document.createElement("span");
    round.textContent = `R${String(frame.round).padStart(2, "0")}`;
    const message = document.createElement("div");
    if (frame.round === 0) {
      message.textContent = `Person #${state.originator} started the rumor.`;
    } else if (frame.newlyReached.size === 0) {
      message.textContent = "No new people shared the rumor.";
    } else {
      const people = [...frame.newlyReached]
        .slice(0, 4)
        .map((nodeId) => `#${nodeId}`)
        .join(", ");
      const remainder = Math.max(0, frame.newlyReached.size - 4);
      message.textContent =
        `${frame.newlyReached.size} new ${frame.newlyReached.size === 1 ? "person" : "people"} ` +
        `reached: ${people}${remainder > 0 ? ` +${remainder}` : ""}.`;
    }
    item.append(round, message);
    return item;
  });
  elements.eventLog.replaceChildren(...entries);
}

function stepSimulation() {
  if (state.frameIndex < state.result.frames.length - 1) {
    state.frameIndex += 1;
    renderFrame();
  }
}

function playbackDelay() {
  return Math.max(180, PLAYBACK_BASE_DELAY_MS - Number(elements.speed.value));
}

function clearAutoPlayback() {
  if (state.autoTimer) {
    window.clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }
}

function scheduleAutoPlayback() {
  clearAutoPlayback();
  if (!elements.autoRun.checked || !state.result) {
    return;
  }

  state.autoTimer = window.setTimeout(() => {
    state.autoTimer = null;
    if (
      elements.autoRun.checked &&
      state.result &&
      state.frameIndex < state.result.frames.length - 1
    ) {
      startPlayback();
    }
  }, AUTO_PLAY_DELAY_MS);
}

function startPlayback() {
  clearAutoPlayback();
  if (state.timer || state.frameIndex >= state.result.frames.length - 1) {
    return;
  }
  elements.playLabel.textContent = "Pause";
  elements.playButton.querySelector(".play-icon").textContent = "Ⅱ";
  elements.simulationStatus.textContent = "Running";
  state.timer = window.setInterval(stepSimulation, playbackDelay());
}

function stopPlayback() {
  clearAutoPlayback();
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
  elements.playLabel.textContent = "Run simulation";
  elements.playButton.querySelector(".play-icon").textContent = "▶";
}

function togglePlayback() {
  if (state.timer) {
    stopPlayback();
    renderFrame();
  } else {
    startPlayback();
  }
}

function resetSimulation() {
  stopPlayback();
  state.frameIndex = 0;
  renderFrame();
}

elements.nodeCount.addEventListener("input", () => {
  elements.nodeCountOutput.value = elements.nodeCount.value;
  setRangeProgress(elements.nodeCount);
});
elements.networkDensity.addEventListener("input", () => {
  elements.networkDensityOutput.value = `${elements.networkDensity.value}%`;
  setRangeProgress(elements.networkDensity);
});
elements.probability.addEventListener("input", () => {
  elements.probabilityOutput.value = `${elements.probability.value}%`;
  setRangeProgress(elements.probability);
  if (state.graph.size > 0) {
    prepareSimulation();
  }
});
elements.speed.addEventListener("input", () => {
  setRangeProgress(elements.speed);
  if (state.timer) {
    stopPlayback();
    startPlayback();
  }
});
elements.autoRun.addEventListener("change", () => {
  if (!state.result) {
    return;
  }
  if (elements.autoRun.checked) {
    if (state.frameIndex >= state.result.frames.length - 1) {
      state.frameIndex = 0;
      renderFrame();
    }
    scheduleAutoPlayback();
  } else {
    stopPlayback();
    renderFrame();
  }
});
elements.networkModel.addEventListener("change", () => {
  updateModelControls();
  loadGraph();
});
elements.hopCount.addEventListener("change", prepareSimulation);
elements.seed.addEventListener("change", loadGraph);
elements.victimSelect.addEventListener("change", () => {
  state.victim = Number(elements.victimSelect.value);
  state.originator = bestOriginator(state.graph, state.victim);
  populateOriginators();
  prepareSimulation();
});
elements.originatorSelect.addEventListener("change", () => {
  state.originator = Number(elements.originatorSelect.value);
  prepareSimulation();
});
elements.regenerateButton.addEventListener("click", loadGraph);
elements.resetButton.addEventListener("click", resetSimulation);
elements.stepButton.addEventListener("click", stepSimulation);
elements.playButton.addEventListener("click", togglePlayback);

for (const input of [
  elements.nodeCount,
  elements.networkDensity,
  elements.probability,
  elements.speed,
]) {
  setRangeProgress(input);
}

updateModelControls();
loadGraph();
