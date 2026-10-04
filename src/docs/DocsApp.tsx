import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { docPages, type DocBlock, type DocPage } from "./content";
import { emailHref, emails } from "../ui/contact";
import { trackEvent } from "../analytics";
import { searchTopic } from "../analytics/schema";
import "./docs.css";

const hrefFor = (page: DocPage) => "/docs/" + page.slug;
const groups = () => [...new Set(docPages.map(page => page.group))];
const imageSizes: Record<string, [number, number]> = {
  "/docs/images/sign-in.webp": [860, 1110],
  "/docs/images/pull-request-report.webp": [1234, 1195],
  "/docs/images/pull-request-evidence.webp": [1234, 454],
};

function Inline({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60|\[[^\]]+\]\((?:\/(?!\/)[^\s)]+|https:\/\/[^\s)]+|mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(?:\?[^\s)]+)?)\))/g);
  return <>{tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.charCodeAt(0) === 96) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\((.+)\)$/);
    return link ? <a key={index} href={link[2]}>{link[1]}</a> : <Fragment key={index}>{token}</Fragment>;
  })}</>;
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    book: <><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3z" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-17-7 2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>,
    moon: <path d="M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    zoom: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5M7 10h6M10 7v6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.book}</svg>;
}

function Sidebar({ active, close }: { active?: string; close: () => void }) {
  return <nav className="docs-navigation" aria-label="Documentation navigation">
    <a className={"docs-overview-link" + (!active ? " is-active" : "")} href="/docs" aria-current={!active ? "page" : undefined} onClick={close}><Icon name="book" size={17} />Documentation home</a>
    {groups().map(group => <div className="docs-nav-group" key={group}>
      <h2>{group}</h2>
      {docPages.filter(page => page.group === group).map(page => <a key={page.slug} className={active === page.slug ? "is-active" : ""} href={hrefFor(page)} aria-current={active === page.slug ? "page" : undefined} onClick={close}>{page.title}</a>)}
    </div>)}
    <div className="docs-sidebar-help"><span>Ready to connect your code?</span><a href="/onboarding">Open workspace setup <Icon name="arrow" size={15} /></a><a href={emailHref("support")}>Contact support <Icon name="arrow" size={15} /></a></div>
  </nav>;
}

function blockText(block: DocBlock): string {
  switch (block.type) {
    case "paragraph": return block.text;
    case "callout": return block.title + " " + block.text;
    case "steps": return block.items.map(item => item.title + " " + item.text).join(" ");
    case "bullets": return block.items.join(" ");
    case "table": return [...block.headers, ...block.rows.flat()].join(" ");
    case "code": return block.value;
    case "image": return block.caption;
    case "links": return block.items.map(item => item.label + " " + (item.description ?? "")).join(" ");
  }
}

function Search({ open, close }: { open: boolean; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const results = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return docPages.map(page => {
      let best = { score: 0, section: "", label: "", snippet: page.description };
      const entries = [{ id: "", title: page.title, text: page.description }, ...page.sections.map(section => ({ id: section.id, title: section.title, text: section.blocks.map(blockText).join(" ") }))];
      for (const entry of entries) {
        const title = (page.title + " " + entry.title).toLowerCase();
        const full = (title + " " + entry.text).toLowerCase();
        if (words.length && !words.every(word => full.includes(word))) continue;
        const score = words.length ? words.reduce((sum, word) => sum + (title.includes(word) ? 25 : 4), 0) : 1;
        if (score > best.score) {
          const plain = entry.text.replace(/\*\*|\x60/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
          const match = words.length ? plain.toLowerCase().indexOf(words[0]) : 0;
          const start = Math.max(0, match - 45);
          best = { score, section: entry.id, label: entry.id ? entry.title : "", snippet: (start ? "…" : "") + plain.slice(start, start + 150) + (plain.length > start + 150 ? "…" : "") };
        }
      }
      return { page, ...best, href: hrefFor(page) + (best.section ? "#" + best.section : "") };
    }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).slice(0, 9);
  }, [query]);
  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    if (!open || !query.trim()) return;
    const timer = setTimeout(() => trackEvent("docs_search", { search_topic: searchTopic(query),
      query_length: query.length, result_count: results.length }), 700);
    return () => clearTimeout(timer);
  }, [open, query, results.length]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) { dialog.current.showModal(); input.current?.focus(); }
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="docs-search-dialog" aria-labelledby="docs-search-title" onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="docs-search-input-wrap"><Icon name="search" /><label id="docs-search-title" className="sr-only" htmlFor="docs-search-input">Search documentation</label>
      <input ref={input} id="docs-search-input" placeholder="Search setup, reports, permissions…" value={query} onChange={event => setQuery(event.target.value)} role="combobox" aria-expanded="true" aria-controls="docs-search-results" aria-activedescendant={results.length ? "docs-result-" + selected : undefined} autoComplete="off" onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelected(previous => results.length ? (previous + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0); }
        if (event.key === "Enter" && results[selected]) { event.preventDefault(); trackEvent("docs_search_result", { doc_slug: results[selected].page.slug, search_topic: searchTopic(query) }); window.location.assign(results[selected].href); }
      }} /><button type="button" onClick={close} aria-label="Close search"><kbd>Esc</kbd></button></div>
    <p className="docs-search-label">{query.trim() ? results.length + " matching guides" : "Explore the documentation"}</p>
    <div id="docs-search-results" role="listbox" className="docs-search-results" aria-label="Search results">
      {results.map((result, index) => <a id={"docs-result-" + index} key={result.page.slug} role="option" aria-selected={selected === index} href={result.href} className={selected === index ? "is-selected" : ""} onMouseEnter={() => setSelected(index)} onClick={() => trackEvent("docs_search_result", { doc_slug: result.page.slug, search_topic: searchTopic(query) })}>
        <span className="docs-search-result-icon"><Icon name="book" /></span><span><small>{result.page.group}{result.label ? " · " + result.label : ""}</small><strong>{result.page.title}</strong><span>{result.snippet}</span></span><Icon name="arrow" size={16} />
      </a>)}
      {!results.length && <div className="docs-search-empty"><strong>No matching guide</strong><p>Try “GitHub”, “indexing”, “email”, or “check”.</p></div>}
    </div>
    <footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open guide</span><span>Search stays in your browser</span></footer>
  </dialog>;
}

function Code({ block }: { block: Extract<DocBlock, { type: "code" }> }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(block.value); setCopied(true); setFailed(false); trackEvent("docs_code_copy", { content_type: block.language }); }
    catch { setFailed(true); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopied(false); setFailed(false); }, 2500);
  }
  return <div className="docs-code"><div className="docs-code-header"><span>{block.filename ?? block.language}</span><button type="button" onClick={() => { void copy(); }}>{copied && <Icon name="check" size={14} />}{copied ? "Copied" : failed ? "Select text to copy" : "Copy"}</button></div><pre><code>{block.value}</code></pre></div>;
}

function Block({ block, preview }: { block: DocBlock; preview: (block: Extract<DocBlock, { type: "image" }>) => void }) {
  switch (block.type) {
    case "paragraph": return <p><Inline text={block.text} /></p>;
    case "callout": return <aside className={"docs-callout docs-callout-" + block.tone}><span className="docs-callout-symbol" aria-hidden="true">{block.tone === "warning" ? "!" : block.tone === "tip" ? "↗" : "i"}</span><div><strong>{block.title}</strong><p><Inline text={block.text} /></p></div></aside>;
    case "steps": return <ol className="docs-steps">{block.items.map((item, index) => <li key={index}><span className="docs-step-number" aria-hidden="true">{index + 1}</span><div><h3><Inline text={item.title} /></h3><p><Inline text={item.text} /></p></div></li>)}</ol>;
    case "bullets": return <ul className="docs-bullets">{block.items.map((item, index) => <li key={index}><Inline text={item} /></li>)}</ul>;
    case "table": return <div className="docs-table-wrap" tabIndex={0} role="region" aria-label={block.headers.join(", ") + " reference table"}><table><thead><tr>{block.headers.map((header, index) => <th key={index} scope="col"><Inline text={header} /></th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}><Inline text={cell} /></td>)}</tr>)}</tbody></table></div>;
    case "code": return <Code block={block} />;
    case "links": return <div className="docs-related-links">{block.items.map(item => <a key={item.href} href={item.href}><span><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</span><Icon name="arrow" size={18} /></a>)}</div>;
    case "image": {
      const size = imageSizes[block.src] ?? [1200, 800];
      return <figure className={"docs-figure" + (block.src.includes("sign-in") ? " docs-figure-sign-in" : "")}><button type="button" onClick={() => preview(block)} aria-label={"Enlarge screenshot: " + block.alt}><img src={block.src} width={size[0]} height={size[1]} alt={block.alt} loading="lazy" decoding="async" /><span><Icon name="zoom" size={16} /> Enlarge</span></button><figcaption>{block.caption}</figcaption></figure>;
    }
  }
}

function Home() {
  const first = docPages.find(page => /quickstart/.test(page.slug)) ?? docPages[0];
  return <>
    <header className="docs-home-heading"><p className="docs-eyebrow">PRODUCT DOCUMENTATION</p><h1>Understand your<br />API changes.</h1><p>Connect your workspace, review downstream impact, and follow the evidence behind every report.</p></header>
    {first && <a className="docs-start-card" href={hrefFor(first)}><div><span className="docs-pill">START HERE</span><h2>Your first Impact Gate report</h2><p>From sign-in and repository setup to an automatic pull request report.</p><span className="docs-text-link">Follow the quickstart <Icon name="arrow" size={18} /></span></div><div className="docs-start-flow" aria-hidden="true"><span>01 <b>Connect</b></span><i>↓</i><span>02 <b>Index</b></span><i>↓</i><span>03 <b>Review</b></span></div></a>}
    <section className="docs-home-groups" aria-label="Browse guides">{groups().map((group, index) => <div className="docs-guide-group" key={group}><div className="docs-guide-group-title"><span>0{index + 1}</span><h2>{group}</h2></div>{docPages.filter(page => page.group === group).map(page => <a key={page.slug} href={hrefFor(page)}><span><strong>{page.title}</strong><small>{page.description}</small></span><Icon name="arrow" size={18} /></a>)}</div>)}</section>
    <aside className="docs-home-boundary"><Icon name="book" size={24} /><div><h2>Evidence first. Uncertainty included.</h2><p>Impact Gate reports are advisory. Learn what the analysis covers and what still needs an engineering review.</p><a href={hrefFor(docPages.find(page => /coverage|supported/.test(page.slug)) ?? first)}>Read the coverage guide <span aria-hidden="true">↗</span></a></div></aside>
  </>;
}

export default function DocsApp({ pathname }: { pathname: string }) {
  const slug = pathname === "/docs" ? undefined : pathname.slice("/docs/".length);
  const page = docPages.find(item => item.slug === slug);
  const unknown = Boolean(slug && !page);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState(page?.sections[0]?.id ?? "");
  const [preview, setPreview] = useState<Extract<DocBlock, { type: "image" }> | null>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const position = page ? docPages.indexOf(page) : -1;

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    document.title = page ? page.title + " | Impact Gate Docs" : "Documentation | Impact Gate Docs";
    if (unknown) { document.title = "Guide not found | Impact Gate Docs"; const robots = document.querySelector('meta[name="robots"]'); robots?.setAttribute("content", "noindex, follow"); }
    function key(event: KeyboardEvent) {
      const editable = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
      if ((event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !editable && !event.metaKey && !event.ctrlKey)) { event.preventDefault(); setMenu(false); setSearch(value => !value); }
      if (event.key === "Escape") setMenu(false);
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [unknown, page]);
  useEffect(() => {
    if (!page || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: "-95px 0px -55% 0px", threshold: 0 });
    page.sections.forEach(section => { const element = document.getElementById(section.id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [page]);
  useEffect(() => {
    if (preview && imageDialog.current && !imageDialog.current.open) imageDialog.current.showModal();
    else if (!preview && imageDialog.current?.open) imageDialog.current.close();
  }, [preview]);
  useEffect(() => {
    if (!menu) return;
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    const previous = document.activeElement;
    const sidebar = document.getElementById("docs-sidebar");
    sidebar?.querySelector<HTMLElement>("a[href]")?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = [...(sidebar?.querySelectorAll<HTMLElement>("a[href],button") ?? [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", trapFocus);
    return () => { document.body.style.overflow = old; document.removeEventListener("keydown", trapFocus); if (previous instanceof HTMLElement) previous.focus(); };
  }, [menu]);
  function toggleTheme() {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("impact-gate-theme", next ? "dark" : "light"); } catch { /* Preference applies to this page. */ }
  }
  return <div className="docs-shell">
    <a className="skip-link" href="#docs-content">Skip to documentation</a>
    <header className="docs-header"><div className="docs-header-inner">
      <a className="docs-brand" href="/" aria-label="Impact Gate home"><img src="/favicon.svg" width="32" height="32" alt="" /><strong>Impact Gate</strong></a><a className="docs-header-label" href="/docs">Docs</a>
      <button type="button" className="docs-search-trigger" aria-label="Search documentation" onClick={() => { setMenu(false); setSearch(true); }}><Icon name="search" size={18} /><span>Search documentation</span><kbd>⌘ / Ctrl K</kbd></button>
      <div className="docs-header-actions"><a href="/dashboard">Dashboard <span aria-hidden="true">↗</span></a><button type="button" className="docs-icon-button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}><Icon name={dark ? "sun" : "moon"} /></button><button type="button" className="docs-icon-button docs-menu-button" aria-label={menu ? "Close documentation navigation" : "Open documentation navigation"} aria-controls="docs-sidebar" aria-expanded={menu} onClick={() => setMenu(value => !value)}><Icon name={menu ? "close" : "menu"} /></button></div>
    </div></header>
    {menu && <button className="docs-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <div className="docs-layout"><aside id="docs-sidebar" className={"docs-sidebar" + (menu ? " is-open" : "")}><Sidebar active={page?.slug} close={() => setMenu(false)} /></aside>
      <main id="docs-content" className="docs-main" tabIndex={-1}>
        <nav className="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/docs">Documentation</a>{page && <><span aria-hidden="true">/</span><span>{page.title}</span></>}</nav>
        {unknown ? <section className="docs-not-found"><p className="docs-eyebrow">GUIDE NOT FOUND</p><h1>Let's find the right guide.</h1><p>This documentation link doesn't match a published page. Browse the guides or use search to find what you need.</p><a className="docs-primary-link" href="/docs">Back to documentation <Icon name="arrow" /></a><button type="button" className="docs-secondary-button" onClick={() => setSearch(true)}>Search the docs</button></section> : page ? <article className="docs-article">
          <header className="docs-article-heading"><p className="docs-eyebrow">{page.group}</p><h1>{page.title}</h1><p>{page.description}</p><div className="docs-article-meta"><span>{page.readingTime} min read</span><span aria-hidden="true">·</span><span>Current pilot</span></div></header>
          <details className="docs-mobile-toc"><summary>On this page</summary><nav aria-label="Article sections">{page.sections.map(section => <a key={section.id} href={"#" + section.id}>{section.title}</a>)}</nav></details>
          {page.sections.map(section => <section id={section.id} key={section.id} className="docs-section"><h2>{section.title}<a className="docs-heading-anchor" href={"#" + section.id} aria-label={"Link to " + section.title}>#</a></h2>{section.blocks.map((block, index) => <Block key={index} block={block} preview={setPreview} />)}</section>)}
          <nav className="docs-pagination" aria-label="Previous and next guides">{position > 0 ? <a href={hrefFor(docPages[position - 1])}><small>← Previous guide</small><strong>{docPages[position - 1].title}</strong></a> : <a href="/docs"><small>← Documentation</small><strong>Browse all guides</strong></a>}{position < docPages.length - 1 && <a href={hrefFor(docPages[position + 1])}><small>Next guide →</small><strong>{docPages[position + 1].title}</strong></a>}</nav>
        </article> : <Home />}
        <aside className="docs-page-help"><div><strong>Still need a hand?</strong><p>Send your setup or product question to <a href={emailHref("support")}>{emails.support}</a>.</p></div><a href="/contact">Contact the team <Icon name="arrow" size={16} /></a></aside>
        <footer className="docs-footer"><span>Impact Gate documentation</span><a href="/docs/troubleshooting">Troubleshooting</a><a href={emailHref("privacy")}>Privacy</a><button type="button" data-analytics-toggle>Usage analytics</button><a href={emailHref("security")}>Security</a><a href="#docs-content">Back to top ↑</a></footer>
      </main>
      <aside className="docs-toc">{page ? <nav aria-label="On this page"><h2>ON THIS PAGE</h2>{page.sections.map(section => <a key={section.id} href={"#" + section.id} className={activeSection === section.id ? "is-active" : ""} aria-current={activeSection === section.id ? "location" : undefined}>{section.title}</a>)}<div className="docs-toc-help"><span>Have a setup question?</span><a href="/docs/troubleshooting">Troubleshooting <Icon name="arrow" size={14} /></a></div></nav> : <div className="docs-start-note"><span className="docs-pill">CURRENT PILOT</span><h2>A clear path to your first report.</h2><p>Start with the quickstart, then explore the workspace guides as you need them.</p><a href="/onboarding">Set up your workspace <Icon name="arrow" size={15} /></a></div>}</aside>
    </div>
    <Search open={search} close={() => setSearch(false)} />
    <dialog ref={imageDialog} className="docs-image-dialog" aria-label={preview ? preview.alt : "Screenshot preview"} onClose={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>{preview && <><button type="button" className="docs-image-close" onClick={() => setPreview(null)} aria-label="Close screenshot"><Icon name="close" /></button><img src={preview.src} alt={preview.alt} /><p>{preview.caption}</p></>}</dialog>
  </div>;
}
