import { createRoot } from "react-dom/client";
import type { WorkspaceSnapshot } from "../../types/workspace";
import { DependencyGraph } from "./DependencyGraph";

export interface MountedRepositoryGraph {
  update: (snapshot: WorkspaceSnapshot) => void;
  destroy: () => void;
}

/** The workspace shell owns the mount; React Flow owns rendering and interaction. */
export function mountDependencyGraph(
  container: HTMLElement,
  snapshot: WorkspaceSnapshot,
): MountedRepositoryGraph {
  const root = createRoot(container);
  const update = (next: WorkspaceSnapshot) =>
    root.render(<DependencyGraph snapshot={next} />);
  update(snapshot);
  return { update, destroy: () => root.unmount() };
}
