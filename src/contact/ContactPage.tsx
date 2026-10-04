import { useEffect } from "react";
import { emailHref, emails, type ContactPurpose } from "../ui/contact";
import "./contact.css";

const channels: Array<{ purpose: ContactPurpose; title: string; description: string; group: "Product & support" | "Company" | "Trust & accounts" }> = [
  { purpose: "pilot", title: "Join the pilot", description: "Private pilot access, onboarding, and your first workspace.", group: "Product & support" },
  { purpose: "support", title: "Get product support", description: "Sign-in, GitHub connections, indexing, and technical questions.", group: "Product & support" },
  { purpose: "info", title: "Learn about Impact Gate", description: "Product information, capabilities, and general questions.", group: "Product & support" },
  { purpose: "contact", title: "Business inquiries", description: "Partnerships, collaboration, and general business conversations.", group: "Company" },
  { purpose: "hello", title: "Say hello", description: "Introductions, ideas, and a first conversation with us.", group: "Company" },
  { purpose: "team", title: "Reach the team", description: "Questions and conversations for the Impact Gate team.", group: "Company" },
  { purpose: "founders", title: "Talk to the founders", description: "Executive conversations, investors, and strategic opportunities.", group: "Company" },
  { purpose: "security", title: "Report a security issue", description: "Vulnerability reports and security disclosures.", group: "Trust & accounts" },
  { purpose: "privacy", title: "Privacy & legal requests", description: "Data requests, privacy, compliance, and legal inquiries.", group: "Trust & accounts" },
  { purpose: "billing", title: "Billing & invoices", description: "Invoices, payments, and accounting questions.", group: "Trust & accounts" },
];

export default function ContactPage() {
  useEffect(() => { document.title = "Contact the team | Impact Gate"; }, []);
  return <main id="main-content" className="contact-page" tabIndex={-1}>
    <div className="container">
      <header className="contact-heading">
        <span className="eyebrow">Talk to Impact Gate</span>
        <h1>Start the right conversation.</h1>
        <p>Get help with your workspace, explore the pilot, or reach the team. Choose the address that fits your question.</p>
        <div className="contact-heading-actions"><a className="button primary" href={emailHref("contact")}>Email us <span aria-hidden="true">→</span></a><a className="button secondary" href="/docs">Explore the docs</a></div>
      </header>
      <aside className="contact-support-note"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z" /></svg><div><strong>Need a hand getting started?</strong><p>Follow the <a href="/docs/quickstart">quickstart</a> or email <a href={emailHref("support")}>{emails.support}</a> with the page and error you’re seeing.</p></div></aside>
      {["Product & support", "Company", "Trust & accounts"].map((group, index) => <section className="contact-group" key={group} aria-labelledby={`contact-group-${index}`}>
        <div className="contact-group-heading"><span aria-hidden="true">0{index + 1}</span><h2 id={`contact-group-${index}`}>{group}</h2></div>
        <div className={"contact-grid" + (group === "Company" ? " contact-grid-company" : "")}>{channels.filter(channel => channel.group === group).map(channel => <a className="contact-card" href={emailHref(channel.purpose)} key={channel.purpose} aria-label={`${channel.title}: ${emails[channel.purpose]}`}>
          <span className="contact-card-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg></span>
          <h3>{channel.title}</h3><p>{channel.description}</p><span className="contact-card-address">{emails[channel.purpose]}<span aria-hidden="true">↗</span></span>
        </a>)}</div>
      </section>)}
      <p className="contact-email-note">Email links open your email app. You can also copy an address into the email service you use.</p>
    </div>
  </main>;
}
