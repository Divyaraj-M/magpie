import { App, Modal, TFile } from "obsidian";
import type MagpiePlugin from "./main";
import { ActivityEvent, monthKey } from "./log";
import { renderEvent } from "./view";

const MAX_MONTHS = 36;

/** Every path a note has had, following rename events back from its current path. */
function pathsOf(plugin: MagpiePlugin, file: TFile): Set<string> {
  const renames = plugin.log.events(0, Infinity).filter((e) => e.k === "rename" && e.op);
  const paths = new Set([file.path]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of renames) if (paths.has(r.p) && r.op && !paths.has(r.op)) { paths.add(r.op); grew = true; }
  }
  return paths;
}

/** Everything recorded for one note, newest first. */
export async function noteHistory(plugin: MagpiePlugin, file: TFile): Promise<ActivityEvent[]> {
  const months: string[] = [];
  const d = new Date(file.stat.ctime || Date.now());
  d.setDate(1);
  while (d.getTime() <= Date.now() && months.length < MAX_MONTHS) { months.push(monthKey(d.getTime())); d.setMonth(d.getMonth() + 1); }
  const now = monthKey(Date.now());
  if (!months.includes(now)) months.push(now);
  await plugin.log.loadMonths(months);
  const paths = pathsOf(plugin, file);
  return plugin.log.events(0, Infinity)
    .filter((e) => paths.has(e.p) || (e.op !== undefined && paths.has(e.op)))
    .sort((a, b) => b.t - a.t);
}

/** Renders one note's history into an element. The newest edit opens its diff. */
export async function renderNoteHistory(el: HTMLElement, plugin: MagpiePlugin, file: TFile) {
  const events = await noteHistory(plugin, file);
  el.empty();
  el.addClass("mgp-root", "mgp-note");
  const list = el.createDiv({ cls: "mgp-day-events" });
  if (!events.length) {
    list.createDiv({ cls: "mgp-empty", text: "Nothing recorded for this note yet. Edits, status changes and ticked checkboxes show up here from now on." });
    return;
  }
  let opened = false;
  for (const ev of events) {
    const openDiff = !opened && !!ev.df?.length;
    if (openDiff) opened = true;
    renderEvent(list, ev, plugin, { date: true, hideTitle: true, openDiff });
  }
}

/** A popup with one note's history. */
export class NoteHistoryModal extends Modal {
  private off: (() => void) | null = null;
  constructor(app: App, private plugin: MagpiePlugin, private file: TFile) { super(app); }
  onOpen() {
    this.setTitle(`History: ${this.file.basename}`);
    this.modalEl.addClass("mgp-modal");
    const body = this.contentEl.createDiv();
    const draw = () => void renderNoteHistory(body, this.plugin, this.file);
    draw();
    this.off = this.plugin.log.onChange(draw);
  }
  onClose() { this.off?.(); this.contentEl.empty(); }
}
