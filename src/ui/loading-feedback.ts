type LoadingTask = { message: string; priority: number; id: number };

export function loadingIndicatorMarkup(message: string): string {
  const safeMessage = message.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ]!,
  );
  return `<div class="ig-loading-indicator ig-loading-indicator-inline" role="status" aria-live="polite" aria-atomic="true"><span class="ig-loading-mark" aria-hidden="true"><img src="/favicon.svg" alt=""></span><span class="ig-loading-label">${safeMessage}</span></div>`;
}

/** One branded, non-blocking loading message shared by site and workspace actions. */
export class LoadingFeedback {
  private readonly tasks = new Map<number, LoadingTask>();
  private nextId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private element: HTMLDivElement | null = null;
  private label: HTMLSpanElement | null = null;

  begin(message: string, priority = 0): () => void {
    const id = ++this.nextId;
    const wasIdle = this.tasks.size === 0;
    this.tasks.set(id, { id, message, priority });
    if (wasIdle) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (!this.tasks.size) return;
        this.ensureElement();
        if (this.element) this.element.hidden = false;
        this.updateLabel();
      }, 140);
    } else {
      this.updateLabel();
    }

    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      this.tasks.delete(id);
      if (!this.tasks.size) {
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.element) this.element.hidden = true;
        return;
      }
      this.updateLabel();
    };
  }

  private ensureElement(): void {
    if (!document.body) return;
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    const host: HTMLElement = dialog ?? document.body;
    if (this.element?.isConnected) {
      if (this.element.parentElement !== host) host.append(this.element);
      return;
    }
    const element = document.createElement("div");
    element.className = "ig-loading-indicator ig-loading-indicator-floating";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.setAttribute("aria-atomic", "true");
    element.hidden = true;
    element.innerHTML = '<span class="ig-loading-mark" aria-hidden="true"><img src="/favicon.svg" alt=""></span><span class="ig-loading-label"></span>';
    host.append(element);
    this.element = element;
    this.label = element.querySelector<HTMLSpanElement>(".ig-loading-label");
  }

  private updateLabel(): void {
    this.ensureElement();
    if (this.element?.hidden || !this.label) return;
    const active = [...this.tasks.values()].sort(
      (left, right) => left.priority - right.priority || left.id - right.id,
    );
    this.label.textContent = active.at(-1)?.message ?? "Loading…";
  }
}

export const loadingFeedback = new LoadingFeedback();
