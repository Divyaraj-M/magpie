export interface CaptureFolder { folder: string; label: string }

export interface MagpieSettings {
  /** Record vault activity. */
  enabled: boolean;
  /** Folder for the log files. Blank: the plugin's own folder. */
  storageFolder: string;
  /** New notes in these folders show as captures with this source label. */
  captureFolders: CaptureFolder[];
  /** Folders whose changes are not recorded. */
  excludeFolders: string[];
  /** Edits to the same note within this many minutes count as one entry. */
  mergeMinutes: number;
  /** Store the added and removed lines of each edit. */
  storeDiffs: boolean;
  /** Longest diff kept per edit, in lines. */
  maxDiffLines: number;
  /** Frontmatter field that holds a note's status. Blank: don't track statuses. */
  statusField: string;
  /** Statuses that mean a task is finished. */
  doneStatuses: string[];
  /** Statuses that mean a task was dropped. */
  killedStatuses: string[];
  /** Frontmatter field holding why a task was dropped. */
  reasonField: string;
  /** Show a history button in each note's header. */
  noteButton: boolean;
  /** Show the Magpie icon in the left ribbon. */
  showRibbon: boolean;
  weekStartsMonday: boolean;
}

export const DEFAULT_SETTINGS: MagpieSettings = {
  enabled: true,
  storageFolder: "",
  captureFolders: [],
  excludeFolders: [],
  mergeMinutes: 10,
  storeDiffs: true,
  maxDiffLines: 200,
  statusField: "status",
  doneStatuses: ["Done", "Completed", "Shipped"],
  killedStatuses: ["Won't do", "Cancelled", "Killed"],
  reasonField: "reason",
  noteButton: true,
  showRibbon: true,
  weekStartsMonday: true,
};

/** Saved data over defaults, so new keys get their default value. */
export function mergeSettings(saved: unknown): MagpieSettings {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== "object") return d;
  const out = { ...d, ...(saved as Partial<MagpieSettings>) };
  for (const k of ["captureFolders", "excludeFolders", "doneStatuses", "killedStatuses"] as const) {
    if (!Array.isArray(out[k])) (out as unknown as Record<string, unknown>)[k] = d[k];
  }
  if (!(out.mergeMinutes > 0)) out.mergeMinutes = d.mergeMinutes;
  if (!(out.maxDiffLines > 0)) out.maxDiffLines = d.maxDiffLines;
  return out;
}
