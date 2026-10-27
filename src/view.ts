import { ItemView, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type MagpiePlugin from "./main";
import { ActivityEvent, Category, categoryOf, monthKey } from "./log";
import { diffStats } from "./text";

export const TIMELINE_VIEW = "magpie-timeline";

const DAY = 86_400_000;
function startOfWeek(d: Date, monday = true): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = monday ? (x.getDay() + 6) % 7 : x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

type Mode = "day" | "week" | "month" | "year";
type Chip = "all" | Category;

const CHIPS: [Chip, string][] = [["all", "All"], ["notes", "Notes"], ["tasks", "Tasks"], ["captures", "Captures"], ["files", "Canvas & files"]];
const MODES: [Mode, string][] = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]];
const PAGE = 200;
const HEAT_WEEKS = 10;

interface Look { label: string; icon: string; tone: string }

function look(ev: ActivityEvent): Look {
  const md = /\.md$/i.test(ev.p);
  switch (ev.k) {
    case "capture": {
      const src = (ev.src ?? "").toLowerCase();
      const icon = /whisper|voice|audio|transcript|record/.test(src) ? "mic" : /clip|web|read|raindrop|pocket|instapaper|bookmark/.test(src) ? "bookmark" : "inbox";
      return { label: `Captured${ev.src ? " · " + ev.src : ""}`, icon, tone: "capture" };
    }
    case "task-done": return { label: "Task completed", icon: "check", tone: "done" };
    case "task-killed": return { label: "Task killed", icon: "x", tone: "killed" };
    case "status": return { label: "Status changed", icon: "circle-dot", tone: "status" };
    case "create": if (ev.id === "opened") return { label: "Task opened", icon: "file-plus", tone: "created" };
      return { label: md ? "Note created" : "File created", icon: md ? "file-plus" : "layout-dashboard", tone: "created" };
    case "edit": return { label: md ? "Note edited" : "File edited", icon: "pencil", tone: "edited" };
    case "rename": return { label: ev.op && dirOf(ev.op) !== dirOf(ev.p) ? "Moved" : "Renamed", icon: "arrow-right-left", tone: "edited" };
    case "delete": return { label: "Deleted", icon: "trash-2", tone: "deleted" };
  }
}
function dirOf(p: string) { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); }
function baseName(p: string) { return (p.split("/").pop() ?? p).replace(/\.md$/i, ""); }
function time(t: number) { return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }); }
function startOfDay(t: number | Date) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a: number, b: number) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

/** The activity timeline: period switcher, filters, the list of entries and the sidebar. */
export class ActivityTimeline {
  mode: Mode = "week";
  anchor = new Date();
  chip: Chip = "all";
  folder = "";
  shown = PAGE;
  private loading = 0;
  private off: () => void;

  constructor(private plugin: MagpiePlugin, public rootEl: HTMLElement, private scope: () => Set<string> | null) {
    this.rootEl.addClass("mgp-root");
    this.off = plugin.log.onChange(() => this.render());
    void this.load(true);
  }
  get app() { return this.plugin.app; }
  get log() { return this.plugin.log; }
  destroy() { this.off(); }

  range(): [Date, Date] {
    const a = this.anchor;
    if (this.mode === "day") { const s = startOfDay(a); return [s, new Date(s.getTime() + DAY)]; }
    if (this.mode === "week") { const s = startOfWeek(a, this.plugin.settings.weekStartsMonday); const e = new Date(s); e.setDate(e.getDate() + 7); return [s, e]; }
    if (this.mode === "month") return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 1)];
    return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear() + 1, 0, 1)];
  }
  heatRange(): [Date, Date] {
    const end = startOfWeek(new Date(), this.plugin.settings.weekStartsMonday);
    end.setDate(end.getDate() + 7);
    const start = new Date(end);
    start.setDate(start.getDate() - HEAT_WEEKS * 7);
    return [start, end];
  }
  private months(): string[] {
    const out = new Set<string>();
    for (const [s, e] of [this.range(), this.heatRange()]) {
      const d = new Date(s.getFullYear(), s.getMonth(), 1);
      while (d < e) { out.add(monthKey(d.getTime())); d.setMonth(d.getMonth() + 1); }
    }
    return [...out];
  }
  async load(fresh = false) {
    this.loading++;
    try { await this.log.loadMonths(this.months(), fresh); } finally { this.loading--; }
    this.render();
  }
  private go(fn: () => void) { fn(); this.shown = PAGE; void this.load(); }

  /** Events that pass the base scope and folder filter (not the type chip). */
  private scoped(from: Date, to: Date): ActivityEvent[] {
    const scope = this.scope();
    const folder = this.folder;
    return this.log.events(from.getTime(), to.getTime()).filter((ev) => {
      if (folder && !(ev.p.startsWith(folder + "/") || (ev.op ?? "").startsWith(folder + "/"))) return false;
      if (scope && !scope.has(ev.p) && !(ev.op && scope.has(ev.op))) {
        const f = this.log.resolve(ev.p);
        if (!f || !scope.has(f.path)) return false;
      }
      return true;
    });
  }

  render() {
    const root = this.rootEl;
    root.empty();
    const main = root.createDiv({ cls: "mgp-main" });
    const side = root.createDiv({ cls: "mgp-side" });
    const [from, to] = this.range();
    const inRange = this.scoped(from, to);
    const list = inRange.filter((ev) => this.chip === "all" || categoryOf(ev) === this.chip).reverse();

    // header
    const head = main.createDiv({ cls: "mgp-head" });
    head.createEl("h2", { cls: "mgp-title", text: "Activity timeline" });
    const seg = head.createDiv({ cls: "mgp-seg" });
    for (const [m, label] of MODES) {
      const b = seg.createEl("button", { text: label, cls: m === this.mode ? "is-active" : "" });
      b.addEventListener("click", () => this.go(() => { this.mode = m; }));
    }
    const nav = main.createDiv({ cls: "mgp-nav" });
    const step = (dir: number) => this.go(() => {
      const a = new Date(this.anchor);
      if (this.mode === "day") a.setDate(a.getDate() + dir);
      else if (this.mode === "week") a.setDate(a.getDate() + 7 * dir);
      else if (this.mode === "month") a.setMonth(a.getMonth() + dir, 1);
      else a.setFullYear(a.getFullYear() + dir);
      this.anchor = a;
    });
    const prev = nav.createEl("button", { cls: "mgp-icon-btn", attr: { "aria-label": "Previous" } });
    setIcon(prev, "chevron-left");
    prev.addEventListener("click", () => step(-1));
    const today = nav.createEl("button", { text: "Today" });
    today.addEventListener("click", () => this.go(() => { this.anchor = new Date(); }));
    const next = nav.createEl("button", { cls: "mgp-icon-btn", attr: { "aria-label": "Next" } });
    setIcon(next, "chevron-right");
    next.addEventListener("click", () => step(1));
    nav.createSpan({ cls: "mgp-range", text: this.rangeLabel(from, to) });

    const chips = main.createDiv({ cls: "mgp-chips" });
    for (const [c, label] of CHIPS) {
      const b = chips.createEl("button", { cls: "mgp-chip" + (c === this.chip ? " is-active" : ""), text: label });
      b.addEventListener("click", () => { this.chip = c; this.shown = PAGE; this.render(); });
    }

    // timeline
    const tl = main.createDiv({ cls: "mgp-list" });
    if (!this.plugin.settings.enabled) {
      tl.createDiv({ cls: "mgp-empty", text: "Activity recording is off. Turn it on in Settings → Magpie." });
    } else if (!list.length) {
      const first = this.log.events(0, Infinity)[0];
      tl.createDiv({ cls: "mgp-empty", text: this.loading > 0 ? "Loading…" : "Nothing recorded for this period." });
      if (this.loading === 0 && (!first || first.t > from.getTime())) {
        tl.createDiv({ cls: "mgp-empty mgp-hint", text: "Magpie records activity from the moment it is on. Days before that stay empty." });
      }
    } else {
      const perDay = new Map<number, number>();
      for (const ev of list) { const k = startOfDay(ev.t).getTime(); perDay.set(k, (perDay.get(k) ?? 0) + 1); }
      let month = "", day = -1;
      let dayEl: HTMLElement = tl;
      for (const ev of list.slice(0, this.shown)) {
        const d = startOfDay(ev.t);
        const mk = monthKey(ev.t);
        if (mk !== month) {
          month = mk;
          tl.createDiv({ cls: "mgp-month", text: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase() });
          day = -1;
        }
        if (d.getTime() !== day) {
          day = d.getTime();
          const h = tl.createDiv({ cls: "mgp-day" });
          h.createSpan({ cls: "mgp-day-name", text: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) });
          const n = perDay.get(day) ?? 0;
          const isToday = sameDay(day, Date.now());
          h.createSpan({ cls: "mgp-day-meta", text: ` · ${isToday ? "Today · " : ""}${n} event${n === 1 ? "" : "s"}` });
          dayEl = tl.createDiv({ cls: "mgp-day-events" });
        }
        this.row(dayEl, ev);
      }
      if (list.length > this.shown) {
        const more = tl.createEl("button", { cls: "mgp-more", text: `Show ${Math.min(PAGE, list.length - this.shown)} more (${list.length - this.shown} left)` });
        more.addEventListener("click", () => { this.shown += PAGE; this.render(); });
      }
    }

    this.sidebar(side, inRange);
  }

  private rangeLabel(from: Date, to: Date): string {
    const last = new Date(to.getTime() - DAY);
    if (this.mode === "day") return from.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (this.mode === "week") return `${from.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${last.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
    if (this.mode === "month") return from.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return String(from.getFullYear());
  }

  private row(parent: HTMLElement, ev: ActivityEvent) { renderEvent(parent, ev, this.plugin); }

  private sidebar(side: HTMLElement, inRange: ActivityEvent[]) {
    // heatmap: weeks as columns, weekdays as rows
    side.createDiv({ cls: "mgp-side-title", text: `Activity · last ${HEAT_WEEKS} weeks` });
    const [hs, he] = this.heatRange();
    const counts = new Map<number, number>();
    for (const ev of this.scoped(hs, he)) {
      if (this.chip !== "all" && categoryOf(ev) !== this.chip) continue;
      const k = startOfDay(ev.t).getTime();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const vals = [...counts.values()].sort((a, b) => a - b);
    const q = (p: number) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0;
    const steps = [q(0.25), q(0.5), q(0.75)];
    const level = (n: number) => (n <= 0 ? 0 : n <= steps[0] ? 1 : n <= steps[1] ? 2 : n <= steps[2] ? 3 : 4);
    const [rs, re] = this.range();
    const grid = side.createDiv({ cls: "mgp-heat" });
    const todayStart = startOfDay(Date.now()).getTime();
    for (let r = 0; r < 7; r++) {
      for (let w = 0; w < HEAT_WEEKS; w++) {
        const d = new Date(hs);
        d.setDate(d.getDate() + w * 7 + r);
        const k = d.getTime();
        const n = counts.get(k) ?? 0;
        const cell = grid.createDiv({ cls: `mgp-cell mgp-l${level(n)}` });
        if (k > todayStart) cell.addClass("is-future");
        if (k >= rs.getTime() && k < re.getTime()) cell.addClass("is-in-range");
        cell.setAttr("aria-label", `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${n} event${n === 1 ? "" : "s"}`);
        cell.addEventListener("click", () => this.go(() => { this.mode = "day"; this.anchor = d; }));
      }
    }

    // counts by type for the shown period
    side.createDiv({ cls: "mgp-side-title", text: "By type" });
    const rows: [string, string, number][] = [
      ["Notes edited", "edited", inRange.filter((e) => e.k === "edit" && categoryOf(e) === "notes").length],
      ["Notes created", "created", inRange.filter((e) => e.k === "create" && categoryOf(e) === "notes").length],
      ["Captures", "capture", inRange.filter((e) => e.k === "capture").length],
      ["Tasks completed", "done", inRange.filter((e) => e.k === "task-done").length],
      ["Tasks killed", "killed", inRange.filter((e) => e.k === "task-killed").length],
    ];
    const files = inRange.filter((e) => categoryOf(e) === "files").length;
    if (files) rows.push(["Canvas & files", "status", files]);
    const max = Math.max(1, ...rows.map((r) => r[2]));
    const bars = side.createDiv({ cls: "mgp-bars" });
    for (const [label, tone, n] of rows) {
      const b = bars.createDiv({ cls: `mgp-bar mgp-${tone}` });
      const top = b.createDiv({ cls: "mgp-bar-top" });
      top.createSpan({ text: label });
      top.createSpan({ cls: "mgp-bar-num", text: String(n) });
      const fill = b.createDiv({ cls: "mgp-bar-track" }).createDiv({ cls: "mgp-bar-fill" });
      fill.style.width = `${(n / max) * 100}%`;
    }

    // folder filter
    side.createDiv({ cls: "mgp-side-title", text: "Folder" });
    const sel = side.createEl("select", { cls: "dropdown mgp-folder" });
    sel.createEl("option", { text: "All folders", attr: { value: "" } });
    const folders = this.app.vault.getRoot().children.filter((c): c is TFolder => c instanceof TFolder && !c.path.startsWith(".")).map((c) => c.path).sort((a, b) => a.localeCompare(b));
    if (this.folder && !folders.includes(this.folder)) folders.unshift(this.folder);
    for (const f of folders) sel.createEl("option", { text: f, attr: { value: f } });
    sel.value = this.folder;
    sel.addEventListener("change", () => { this.folder = sel.value; this.shown = PAGE; this.render(); });
  }
}

/** The timeline in its own tab, for the whole vault. */
export class TimelineView extends ItemView {
  timeline: ActivityTimeline | null = null;
  constructor(leaf: WorkspaceLeaf, private plugin: MagpiePlugin) { super(leaf); }
  getViewType() { return TIMELINE_VIEW; }
  getDisplayText() { return "Activity timeline"; }
  getIcon() { return "bird"; }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mgp-pane");
    this.timeline = new ActivityTimeline(this.plugin, this.contentEl.createDiv(), () => null);
  }
  async onClose() { this.timeline?.destroy(); }
}

/** One timeline entry: time, icon on the rail, and a card. */
export function renderEvent(parent: HTMLElement, ev: ActivityEvent, plugin: MagpiePlugin, opts: { date?: boolean; hideTitle?: boolean; openDiff?: boolean } = {}) {
  const L = look(ev);
  const row = parent.createDiv({ cls: `mgp-row mgp-${L.tone}` });
  const tm = row.createDiv({ cls: "mgp-time" });
  if (opts.date) tm.createDiv({ cls: "mgp-date", text: new Date(ev.t).toLocaleDateString(undefined, new Date(ev.t).getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }) });
  if (!ev.dayOnly) tm.createDiv({ text: time(ev.t) });
  const rail = row.createDiv({ cls: "mgp-rail" });
  setIcon(rail.createDiv({ cls: "mgp-dot" }), L.icon);
  const card = row.createDiv({ cls: "mgp-card" });
  card.createDiv({ cls: "mgp-kind", text: L.label.toUpperCase() });

  const file = ev.k === "delete" ? null : plugin.log.resolve(ev.p);
  const title = ev.ti || baseName(ev.p);
  const t = card.createDiv({ cls: "mgp-card-title" });
  if (opts.hideTitle && !ev.ti) t.hide();
  else if (file) {
    const a = t.createEl("a", { cls: "mgp-link", text: title, href: "#" });
    a.addEventListener("click", (e) => { e.preventDefault(); void plugin.app.workspace.getLeaf(e.ctrlKey || e.metaKey).openFile(file); });
  } else t.createSpan({ cls: ev.k === "delete" ? "mgp-gone" : "", text: title });

  if (ev.k === "task-killed" && ev.r) {
    const r = card.createDiv({ cls: "mgp-preview" });
    r.createSpan({ cls: "mgp-muted", text: "Reason: " });
    r.appendText(ev.r);
  }
  const meta = card.createDiv({ cls: "mgp-meta" });
  const path = file ? file.path : ev.p;
  if (ev.k === "rename") meta.setText(`${ev.op ?? ""} → ${ev.p}`);
  else if (ev.from !== undefined && ev.to !== undefined) meta.setText(`${ev.from} → ${ev.to}`);
  else if (ev.ti) meta.setText(`in ${path}`);
  else {
    const bits = [path];
    if (ev.k === "edit" && ev.n) bits.push(`${ev.n} line${ev.n === 1 ? "" : "s"} changed`);
    if (ev.k === "edit" && ev.e && ev.e - ev.t > 60_000) bits.push(`until ${time(ev.e)}`);
    meta.setText(bits.join(" · "));
  }
  if (ev.df && ev.df.length) {
    renderDiff(card, ev, !!opts.openDiff);
  } else if (ev.pv && ev.k !== "task-killed" && ev.k !== "status") card.createDiv({ cls: "mgp-preview", text: ev.pv });
}

/** The changed lines of an edit: a one-line summary that expands into a red / green diff. */
function renderDiff(card: HTMLElement, ev: ActivityEvent, open: boolean) {
  const { added, removed } = diffStats(ev.df ?? []);
  if (ev.pv) card.createDiv({ cls: "mgp-preview", text: ev.pv });
  const det = card.createEl("details", { cls: "mgp-diff" });
  det.open = open;
  const sum = det.createEl("summary");
  sum.createSpan({ text: "Show changes " });
  sum.createSpan({ cls: "mgp-add", text: `+${added}` });
  sum.appendText(" ");
  sum.createSpan({ cls: "mgp-del", text: `−${removed}` });
  const pre = det.createDiv({ cls: "mgp-diff-body" });
  for (const line of ev.df ?? []) {
    const kind = line[0];
    if (kind === "@") { pre.createDiv({ cls: "mgp-gap", text: line.length > 1 ? line.slice(1).trim() : "⋯" }); continue; }
    const row = pre.createDiv({ cls: kind === "+" ? "mgp-line mgp-line-add" : kind === "-" ? "mgp-line mgp-line-del" : "mgp-line" });
    row.createSpan({ cls: "mgp-sign", text: kind === " " ? "" : kind === "-" ? "−" : "+" });
    row.createSpan({ text: line.slice(1) || " " });
  }
}
