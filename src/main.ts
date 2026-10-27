import { MarkdownView, Plugin, TFile } from "obsidian";
import { MagpieSettings, mergeSettings } from "./settings";
import { MagpieSettingTab } from "./settingsTab";
import { ActivityLog, monthKey } from "./log";
import { TIMELINE_VIEW, TimelineView } from "./view";
import { NoteHistoryModal } from "./history";

export default class MagpiePlugin extends Plugin {
  settings: MagpieSettings;
  log: ActivityLog;
  ribbonEl: HTMLElement | null = null;
  private noteButtons = new Map<MarkdownView, HTMLElement>();

  async onload() {
    this.settings = mergeSettings(await this.loadData());
    this.log = new ActivityLog(this);

    this.registerView(TIMELINE_VIEW, (leaf) => new TimelineView(leaf, this));
    this.ribbonEl = this.addRibbonIcon("bird", "Open activity timeline", () => void this.openTimeline());
    this.refreshRibbon();
    this.addSettingTab(new MagpieSettingTab(this.app, this));

    this.addCommand({ id: "open-timeline", name: "Open activity timeline", callback: () => void this.openTimeline() });
    this.addCommand({
      id: "note-history", name: "Show history of this note", checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.openNoteHistory(file);
        return true;
      },
    });

    this.app.workspace.onLayoutReady(() => {
      const log = this.log;
      void log.loadMonths([monthKey(Date.now())]);
      log.seedStatuses();
      this.registerEvent(this.app.vault.on("create", (f) => void log.onCreate(f)));
      this.registerEvent(this.app.vault.on("modify", (f) => void log.onModify(f)));
      this.registerEvent(this.app.vault.on("rename", (f, old) => log.onRename(f, old)));
      this.registerEvent(this.app.vault.on("delete", (f) => log.onDelete(f)));
      this.registerEvent(this.app.metadataCache.on("changed", (f) => log.onMetadata(f)));
      this.registerEvent(this.app.workspace.on("file-open", (f) => void log.onOpen(f)));
      void log.onOpen(this.app.workspace.getActiveFile());

      this.registerEvent(this.app.workspace.on("file-menu", (menu, f) => {
        if (!(f instanceof TFile)) return;
        menu.addItem((i) => i.setTitle("Show history").setIcon("lucide-history").onClick(() => this.openNoteHistory(f)));
      }));

      this.addNoteButtons();
      this.registerEvent(this.app.workspace.on("layout-change", () => this.addNoteButtons()));
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.addNoteButtons()));
    });
  }

  onunload() {
    void this.log?.flush();
    for (const el of this.noteButtons.values()) el.remove();
    this.noteButtons.clear();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  refreshRibbon() {
    this.ribbonEl?.toggle(this.settings.showRibbon);
  }

  /** Opens the timeline in a tab, or brings the open one forward. */
  async openTimeline() {
    const existing = this.app.workspace.getLeavesOfType(TIMELINE_VIEW)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: TIMELINE_VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  openNoteHistory(file: TFile) {
    new NoteHistoryModal(this.app, this, file).open();
  }

  /** Adds (or removes, per the setting) the history button in every open note's header. */
  addNoteButtons() {
    const on = this.settings.noteButton;
    for (const [view, el] of this.noteButtons) {
      if (!on || !view.containerEl.isConnected) { el.remove(); this.noteButtons.delete(view); }
    }
    if (!on) return;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || this.noteButtons.has(view)) continue;
      const el = view.addAction("lucide-history", "Show history of this note", () => {
        if (view.file) this.openNoteHistory(view.file);
      });
      this.noteButtons.set(view, el);
    }
  }
}
