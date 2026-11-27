/**
 * Query consoles in "Scratches and Consoles" (IDEA's Database Consoles): a group with one folder
 * per data source, named after the data source. The console folders on disk are named after the
 * data source id (`<data dir>/consoles/db/<id>` or `<id>.<database>`, see `console_dir`); a folder
 * whose data source is gone is left out.
 */
import type { DataSource } from "@/platform/ipc";
import { call, commands, isTauri } from "@/platform/ipc";
import { useRemote } from "@/platform/remote";
import { scratchesDir } from "@/platform/scratchesDir";
import { registerProjectViewRoot, type ProjectViewRootEntry } from "@/workbench/contributions";
import { sourceIcon } from "./model";
import { useDatabase } from "./store";

export const CONSOLES_ROOT_ID = "database-consoles";

/** The group's folders: the console folders `names` of `dir` whose data source still exists, by its name. */
export function consoleFolders(
  dir: string,
  names: readonly string[],
  sources: readonly DataSource[],
): ProjectViewRootEntry[] {
  const out: ProjectViewRootEntry[] = [];
  for (const name of names) {
    // `<id>` for the default database, `<id>.<database>` for the others; ids have no dots.
    const dot = name.indexOf(".");
    const id = dot < 0 ? name : name.slice(0, dot);
    const source = sources.find((s) => s.id === id);
    if (!source) continue;
    const label = source.name || id;
    out.push({
      label: dot < 0 ? label : `${label}: ${name.slice(dot + 1)}`,
      icon: sourceIcon(source),
      path: `${dir}/${name}`,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Keeps the Database Consoles group in step with the data sources and their console folders. */
export function installConsoleRoots(): () => void {
  if (!isTauri()) return () => {};
  let disposed = false;
  let unregister = () => {};
  let generation = 0;
  const refresh = async () => {
    const current = ++generation;
    try {
      // A sibling of the scratches folder, on the host that runs the window's file commands.
      const dir = `${(await scratchesDir()).replace(/\/[^/]*$/, "")}/consoles/db`;
      const entries = await call(commands.fsReadDir(dir)).catch(() => []);
      if (disposed || current !== generation) return;
      const names = entries.filter((e) => e.kind === "dir").map((e) => e.name);
      const children = consoleFolders(dir, names, useDatabase.getState().sources);
      unregister();
      unregister = children.length
        ? registerProjectViewRoot({
            id: CONSOLES_ROOT_ID,
            label: "Database Consoles",
            icon: "db-console",
            children,
            order: 11,
            scope: "scratches",
          })
        : () => {};
    } catch (e) {
      console.warn("database consoles: cannot list the consoles folder", e);
    }
  };
  void refresh();
  const disposers = [
    // A new console can add a folder; a renamed or removed data source changes or drops one.
    useDatabase.subscribe((s, prev) => {
      if (s.sources !== prev.sources || s.consoles !== prev.consoles) void refresh();
    }),
    useRemote.subscribe((s, prev) => {
      if (s.session !== prev.session) void refresh();
    }),
  ];
  return () => {
    disposed = true;
    unregister();
    disposers.forEach((d) => d());
  };
}
