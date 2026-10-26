import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { GraphScene } from "./project";

export const CARD_WIDTH = 244;
export const CARD_HEIGHT = 112;
const elk = new ELK();

export interface LayoutPosition {
  x: number;
  y: number;
}

/** ELK lays out connected components, then packs the components and isolated nodes. */
export async function layoutGraph(
  scene: GraphScene,
): Promise<Map<string, LayoutPosition>> {
  if (!scene.nodes.length) return new Map();
  const neighbors = new Map(
    scene.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const edge of scene.edges) {
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of scene.nodes) {
    if (visited.has(node.id)) continue;
    const pending = [node.id];
    const component: string[] = [];
    visited.add(node.id);
    while (pending.length) {
      const id = pending.pop()!;
      component.push(id);
      for (const neighbor of neighbors.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const children: ElkNode[] = components.map((ids, index) => {
    if (ids.length === 1 && !scene.edges.some((edge) => edge.source === ids[0]))
      return { id: ids[0], width: CARD_WIDTH, height: CARD_HEIGHT };
    const members = new Set(ids);
    return {
      id: `component:${index}`,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.wrapping.strategy": "MULTI_EDGE",
        "elk.aspectRatio": "1.65",
        "elk.spacing.nodeNode": "42",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.padding": "[top=12,left=12,bottom=12,right=12]",
        "elk.randomSeed": "1",
      },
      children: ids.map((id) => ({
        id,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      })),
      edges: scene.edges
        .filter((edge) => members.has(edge.source))
        .map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
    };
  });
  const laidOut = await elk.layout({
    id: "graph",
    layoutOptions: {
      "elk.algorithm": "box",
      "elk.aspectRatio": "3",
      "elk.spacing.nodeNode": "36",
      "elk.padding": "[top=30,left=30,bottom=30,right=30]",
    },
    children,
  });
  const positions = new Map<string, LayoutPosition>();
  for (const child of laidOut.children ?? []) {
    if (child.children) {
      for (const node of child.children)
        positions.set(node.id, {
          x: (child.x ?? 0) + (node.x ?? 0),
          y: (child.y ?? 0) + (node.y ?? 0),
        });
    } else positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return positions;
}
