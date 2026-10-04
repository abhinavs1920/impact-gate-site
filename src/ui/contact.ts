import emails from "../data/contact-emails.json";

export { emails };
export type ContactPurpose = keyof typeof emails;

export function emailHref(purpose: ContactPurpose, subject?: string): string {
  return `mailto:${emails[purpose]}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
