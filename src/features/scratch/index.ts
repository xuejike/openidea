/**
 * Scratch Files (⇧⌘N): throwaway files in any language, stored in the app
 * data dir and listed under "Scratches" in the Project view.
 */
import { registerActions } from "@/platform/actions";
import { onFileOperation } from "@/platform/fileOps";
import { emitLocalIdeEvent } from "@/platform/ipc";
import { useRemote } from "@/platform/remote";
import { registerMenuGroup, registerOverlay, registerProjectViewRoot } from "@/workbench/contributions";
import { ScratchChooserHost } from "./ScratchChooser";
import { openChooser } from "./store";
import { scratchBackend, consolesDir, scratchesAvailable, scratchesDir } from "./scratches";

export const SCRATCHES_ROOT_LABEL = "Scratches";
export const CONSOLES_ROOT_LABEL = "Database Consoles";

export async function newScratchFile() {
  openChooser(await scratchBackend().languages());
}

export function activate(): () => void {
  let disposed = false;
  let unregisterRoot = () => {};
  let unregisterConsoles = () => {};
  let dir: string | null = null;
  let consoles: string | null = null;
  let generation = 0;
  const registerRoot = () => {
    const current = ++generation;
    unregisterRoot();
    unregisterConsoles();
    unregisterRoot = () => {};
    unregisterConsoles = () => {};
    dir = null;
    consoles = null;
    // Query consoles are files too: listed beside the scratches so a closed console can be reopened.
    void consolesDir()
      .then((path) => {
        if (disposed || current !== generation) return;
        consoles = path;
        unregisterConsoles = registerProjectViewRoot({
          id: "database-consoles",
          label: CONSOLES_ROOT_LABEL,
          icon: "db-console",
          path,
          order: 11,
          scope: "scratches",
        });
      })
      .catch((e: unknown) => console.warn("scratch files: no database consoles folder", e));
    void scratchesDir()
      .then((path) => {
        if (disposed || current !== generation) return;
        dir = path;
        unregisterRoot = registerProjectViewRoot({
          id: "scratches",
          label: SCRATCHES_ROOT_LABEL,
          icon: "scratches",
          path,
          order: 10,
          scope: "scratches",
        });
      })
      .catch((e: unknown) => console.warn("scratch files: no scratches folder", e));
  };
  if (scratchesAvailable()) registerRoot();
  const disposers = [
    // Attaching to (or leaving) a remote server moves the scratches to that host.
    useRemote.subscribe((state, previous) => {
      if (state.session !== previous.session && scratchesAvailable()) registerRoot();
    }),
    // The file watcher covers the project only: deleted scratches close their editors like watched files.
    onFileOperation((op) => {
      const removed = [dir, consoles].flatMap((root) =>
        root && op.kind === "deleted" ? op.paths.filter((p) => p === root || p.startsWith(`${root}/`)) : [],
      );
      if (removed.length) emitLocalIdeEvent({ type: "fsChanged", created: [], modified: [], removed });
    }),
    registerOverlay({ id: "scratch.chooser", component: ScratchChooserHost }),
    // IDEA lists it near the top of the New popup.
    registerMenuGroup({
      id: "scratch.new",
      menus: ["new"],
      order: 0,
      items: () => [{ kind: "action", action: "file.newScratchFile", label: "Scratch File" }],
    }),
    registerActions([
      {
        id: "file.newScratchFile",
        title: "New Scratch File…",
        category: "File",
        icon: "scratches",
        keywords: ["scratch", "temporary file", "buffer"],
        when: "projectOpen",
        run: () => newScratchFile(),
      },
    ]),
  ];
  return () => {
    disposed = true;
    unregisterRoot();
    unregisterConsoles();
    disposers.reverse().forEach((d) => d());
  };
}
