import assert from "node:assert/strict";
import test from "node:test";

import {
  createGraph,
  createSeededRandom,
  createSmallWorldGraph,
  getAvailableNodes,
  graphEdges,
  simulateGossip,
} from "../demo/simulation.mjs";

test("getAvailableNodes limits the rumor to the requested hop count", () => {
  const graph = createGraph(
    [0, 1, 2, 3, 4],
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [3, 4],
    ],
  );

  assert.deepEqual(getAvailableNodes(graph, 0, 1), new Set([1, 2]));
  assert.deepEqual(getAvailableNodes(graph, 0, 2), new Set([1, 2, 3]));
  assert.deepEqual(getAvailableNodes(graph, 0, 0), new Set([1, 2, 3, 4]));
});

test("simulateGossip reaches all focal friends when every share succeeds", () => {
  const graph = createGraph(
    [0, 1, 2, 3],
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [3, 2],
    ],
  );

  const result = simulateGossip({
    graph,
    victim: 0,
    originator: 1,
    hopCount: 2,
    probability: 1,
  });
  const finalFrame = result.frames.at(-1);

  assert.equal(finalFrame.spreadFactor, 1);
  assert.equal(finalFrame.totalFactor, 1);
  assert.equal(finalFrame.spreadTime, 2);
  assert.deepEqual(finalFrame.reached, new Set([1, 3, 2]));
});

test("simulateGossip keeps only the originator when sharing probability is zero", () => {
  const graph = createGraph(
    [0, 1, 2],
    [
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  );

  const result = simulateGossip({
    graph,
    victim: 0,
    originator: 1,
    hopCount: 1,
    probability: 0,
    random: () => 0.5,
  });
  const finalFrame = result.frames.at(-1);

  assert.equal(finalFrame.spreadFactor, 0.5);
  assert.equal(finalFrame.totalFactor, 0.5);
  assert.deepEqual(finalFrame.reached, new Set([1]));
});

test("seeded small-world generation is reproducible", () => {
  const firstGraph = createSmallWorldGraph(24, 4, 0.2, createSeededRandom(42));
  const secondGraph = createSmallWorldGraph(24, 4, 0.2, createSeededRandom(42));

  assert.deepEqual(graphEdges(firstGraph), graphEdges(secondGraph));
});
