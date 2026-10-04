import paths from "./icon-paths.json";

export type IconName = keyof typeof paths;

/** Local SVGs keep UI controls legible when external fonts are unavailable. */
export function uiIcon(name: IconName): string {
  return `<svg class="ig-ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

export function providerIcon(provider: "google" | "github"): string {
  if (provider === "google") return '<img class="ig-provider-icon ig-google-icon" src="/icons/google.png" width="20" height="20" alt="" aria-hidden="true">';
  return '<svg class="ig-provider-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.54 2.36 1.1 2.93.84.09-.65.35-1.1.64-1.35-2.22-.25-4.56-1.12-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.66.64.7 1.03 1.59 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>';
}
