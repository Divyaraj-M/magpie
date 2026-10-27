import { App, PluginSettingTab, Setting } from "obsidian";
import type MagpiePlugin from "./main";

const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const commas = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

export class MagpieSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: MagpiePlugin) { super(app, plugin); }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();

    new Setting(containerEl).setName("Record activity")
      .setDesc("Records notes created and edited, captures, ticked checkboxes and status changes from now on. Each device writes its own log file, so synced vaults do not clash.")
      .addToggle((t) => t.setValue(s.enabled).onChange(async (v) => { s.enabled = v; await save(); }));
    new Setting(containerEl).setName("Open the activity timeline")
      .addButton((b) => b.setButtonText("Open").setCta().onClick(() => void this.plugin.openTimeline()));
    new Setting(containerEl).setName("Icon in the left ribbon")
      .addToggle((t) => t.setValue(s.showRibbon).onChange(async (v) => { s.showRibbon = v; await save(); this.plugin.refreshRibbon(); }));
    new Setting(containerEl).setName("History button in notes")
      .setDesc("Adds a history icon next to the edit button at the top of every note.")
      .addToggle((t) => t.setValue(s.noteButton).onChange(async (v) => { s.noteButton = v; await save(); this.plugin.addNoteButtons(); }));
    new Setting(containerEl).setName("First day of the week")
      .addDropdown((d) => d.addOption("mon", "Monday").addOption("sun", "Sunday").setValue(s.weekStartsMonday ? "mon" : "sun")
        .onChange(async (v) => { s.weekStartsMonday = v === "mon"; await save(); }));

    new Setting(containerEl).setName("Edits").setHeading();
    new Setting(containerEl).setName("Keep what changed")
      .setDesc("Stores the added and removed lines of each edit, so you can see exactly what changed. Turn off to keep only a short preview.")
      .addToggle((t) => t.setValue(s.storeDiffs).onChange(async (v) => { s.storeDiffs = v; await save(); }));
    new Setting(containerEl).setName("Longest change kept (lines)")
      .addText((t) => t.setValue(String(s.maxDiffLines)).onChange(async (v) => { const n = parseInt(v, 10); if (n > 0) { s.maxDiffLines = n; await save(); } }));
    new Setting(containerEl).setName("Group edits within (minutes)")
      .setDesc("Edits to the same note within this time count as one entry.")
      .addText((t) => t.setValue(String(s.mergeMinutes)).onChange(async (v) => { const n = parseInt(v, 10); if (n > 0) { s.mergeMinutes = n; await save(); } }));

    new Setting(containerEl).setName("Folders").setHeading();
    new Setting(containerEl).setName("Capture folders")
      .setDesc("New notes in these folders show as captures. One per line, as folder = source label.")
      .addTextArea((t) => t.setPlaceholder("Clippings = web clipper").setValue(s.captureFolders.map((c) => `${c.folder} = ${c.label}`).join("\n"))
        .onChange(async (v) => {
          s.captureFolders = lines(v).map((l) => { const [folder, ...rest] = l.split("="); return { folder: folder.trim(), label: rest.join("=").trim() }; }).filter((c) => c.folder);
          await save();
        }));
    new Setting(containerEl).setName("Folders to skip").setDesc("Changes inside these folders are not recorded. One per line.")
      .addTextArea((t) => t.setPlaceholder("Templates").setValue(s.excludeFolders.join("\n")).onChange(async (v) => { s.excludeFolders = lines(v); await save(); }));
    new Setting(containerEl).setName("Log folder")
      .setDesc("Where the log files go. Leave blank for the plugin's own folder. Pick a vault folder if you want the log to sync with your notes.")
      .addText((t) => t.setPlaceholder("Plugin folder").setValue(s.storageFolder).onChange(async (v) => { s.storageFolder = v.trim(); await save(); }));

    new Setting(containerEl).setName("Tasks").setHeading();
    new Setting(containerEl).setName("Status field")
      .setDesc("Frontmatter field with a note's status. Changes show on the timeline. Leave blank to ignore statuses.")
      .addText((t) => t.setValue(s.statusField).onChange(async (v) => { s.statusField = v.trim(); await save(); this.plugin.log.seedStatuses(); }));
    new Setting(containerEl).setName("Done statuses").setDesc("Comma separated. Moving to one of these shows as a completed task.")
      .addText((t) => t.setValue(s.doneStatuses.join(", ")).onChange(async (v) => { s.doneStatuses = commas(v); await save(); }));
    new Setting(containerEl).setName("Killed statuses").setDesc("Comma separated. Moving to one of these shows as a killed task. Cancelled checkboxes ([-]) count too.")
      .addText((t) => t.setValue(s.killedStatuses.join(", ")).onChange(async (v) => { s.killedStatuses = commas(v); await save(); }));
    new Setting(containerEl).setName("Reason field").setDesc("Frontmatter field with why a task was killed.")
      .addText((t) => t.setValue(s.reasonField).onChange(async (v) => { s.reasonField = v.trim() || "reason"; await save(); }));
  }
}
