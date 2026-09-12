import { useCallback, useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project, ProjectIcon, Theme } from "../types";

const FILE = "locl.json";

/** Guessed from the folder contents so a fresh import isn't all grey boxes. */
function guessIcon(name: string): ProjectIcon {
  const n = name.toLowerCase();
  if (/site|web|www|landing|marketing/.test(n)) return "globe";
  if (/portfolio|personal|blog/.test(n)) return "code";
  if (/book|mark|note|read/.test(n)) return "bookmark";
  if (/api|server|service|worker/.test(n)) return "zap";
  if (/design|ui|kit|studio/.test(n)) return "leaf";
  return "box";
}

const baseName = (p: string) =>
  p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;

const titleCase = (s: string) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [theme, setThemeState] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const store = useRef<Store | null>(null);

  useEffect(() => {
    (async () => {
      const s = await load(FILE, { autoSave: true });
      store.current = s;
      setProjects((await s.get<Project[]>("projects")) ?? []);
      setThemeState((await s.get<Theme>("theme")) ?? "light");
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: Project[]) => {
    setProjects(next);
    store.current?.set("projects", next);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    store.current?.set("theme", t);
  }, []);

  /** Opens the OS folder picker; supports picking several at once. */
  const addProjects = useCallback(async () => {
    const picked = await open({ directory: true, multiple: true });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];

    setProjects((prev) => {
      const seen = new Set(prev.map((p) => p.path.toLowerCase()));
      const fresh = paths
        .filter((p) => !seen.has(p.toLowerCase()))
        .map<Project>((path) => {
          const folder = baseName(path);
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: titleCase(folder),
            path,
            command: "npm run dev",
            icon: guessIcon(folder),
          };
        });
      const next = [...prev, ...fresh];
      store.current?.set("projects", next);
      return next;
    });
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Project>) =>
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
        store.current?.set("projects", next);
        return next;
      }),
    [],
  );

  const remove = useCallback(
    (id: string) =>
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        store.current?.set("projects", next);
        return next;
      }),
    [],
  );

  return {
    projects,
    ready,
    theme,
    setTheme,
    addProjects,
    update,
    remove,
    reorder: persist,
  };
}
