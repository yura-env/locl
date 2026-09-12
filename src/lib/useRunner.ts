import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LogLine, Project, RunState } from "../types";

const MAX_LOGS = 300;

const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*\x07/g;
const strip = (s: string) => s.replace(ANSI, "").replace(/\r/g, "");

const PORT_PATTERNS = [
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})/i,
  /\bport\s*[:=]?\s*(\d{4,5})\b/i,
];

function sniffPort(line: string): number | undefined {
  for (const re of PORT_PATTERNS) {
    const m = line.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && n < 65536) return n;
    }
  }
  return undefined;
}

const READY =
  /\b(ready|listening|compiled successfully|server running|started server|local:)\b/i;

const idle = (): RunState => ({ status: "idle", logs: [] });

export function useRunner() {
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const seq = useRef(0);

  const patch = useCallback(
    (id: string, fn: (prev: RunState) => RunState) =>
      setRuns((all) => ({ ...all, [id]: fn(all[id] ?? idle()) })),
    [],
  );

  useEffect(() => {
    // `listen` resolves asynchronously, so a subscription started before an
    // unmount can land after it. Without the flag that listener leaks and
    // every log line arrives twice (StrictMode makes this happen every time).
    let dead = false;
    const offs: UnlistenFn[] = [];
    const keep = (p: Promise<UnlistenFn>) =>
      p.then((un) => (dead ? un() : offs.push(un))).catch(() => {});

    keep(
      listen<{ id: string; stream: "stdout" | "stderr"; line: string }>(
      "proc-log",
      ({ payload }) => {
        const text = strip(payload.line);
        if (!text.trim()) return;

        patch(payload.id, (prev) => {
          const port = prev.port ?? sniffPort(text);
          const ok = READY.test(text);
          const line: LogLine = {
            key: seq.current++,
            stream: payload.stream,
            text,
            ok,
          };
          const logs = [...prev.logs, line].slice(-MAX_LOGS);
          return {
            ...prev,
            logs,
            port,
            url: port ? `http://localhost:${port}` : prev.url,
            // A dev server is "running" once it says something useful, not
            // the instant the shell starts. That's what the spinner is for.
            status:
              prev.status === "stopping"
                ? "stopping"
                : ok || port
                  ? "running"
                  : prev.status === "idle"
                    ? "starting"
                    : prev.status,
          };
        });
        },
      ),
    );

    keep(
      listen<{ id: string; code: number | null }>(
        "proc-exit",
      ({ payload }) => {
        patch(payload.id, (prev) => {
          // A stop the user asked for is not a failure, and an exit for a
          // project already marked idle says nothing new.
          const expected =
            prev.status === "stopping" ||
            prev.status === "idle" ||
            !payload.code;
          return {
            ...prev,
            status: expected ? "idle" : "error",
            port: undefined,
            url: undefined,
            error: expected ? undefined : `Exited with code ${payload.code}`,
          };
          });
        },
      ),
    );

    keep(
      listen("stopped-all", () => {
      setRuns((all) =>
        Object.fromEntries(
          Object.entries(all).map(([id, r]) => [
            id,
            { ...r, status: "idle" as const, port: undefined, url: undefined },
          ]),
          ),
        );
      }),
    );

    // Rust owns the truth about what's running, so a reloaded webview asks
    // rather than assuming everything is stopped.
    invoke<string[]>("running_ids")
      .then((ids) => {
        if (dead) return;
        setRuns((all) => {
          const next = { ...all };
          for (const id of ids) {
            next[id] = { ...(next[id] ?? idle()), status: "running" };
          }
          return next;
        });
      })
      .catch(() => {});

    return () => {
      dead = true;
      offs.forEach((off) => off());
    };
  }, [patch]);

  const start = useCallback(
    async (p: Project) => {
      patch(p.id, () => ({ status: "starting", logs: [] }));
      try {
        await invoke("start_project", {
          id: p.id,
          path: p.path,
          command: p.command,
        });
      } catch (e) {
        patch(p.id, (prev) => ({
          ...prev,
          status: "error",
          error: String(e),
        }));
      }
    },
    [patch],
  );

  const stop = useCallback(
    async (id: string) => {
      patch(id, (prev) => ({ ...prev, status: "stopping" }));
      try {
        await invoke("stop_project", { id });
      } catch {
        patch(id, (prev) => ({ ...prev, status: "idle" }));
      }
    },
    [patch],
  );

  const stopAll = useCallback(async () => {
    setRuns((all) =>
      Object.fromEntries(
        Object.entries(all).map(([id, r]) => [
          id,
          r.status === "idle" ? r : { ...r, status: "stopping" as const },
        ]),
      ),
    );
    await invoke("stop_all");
  }, []);

  const get = useCallback((id: string) => runs[id] ?? idle(), [runs]);

  const all = Object.values(runs);
  // Kept apart so the header can say "starting" before it says "running".
  const runningCount = all.filter((r) => r.status === "running").length;
  const startingCount = all.filter(
    (r) => r.status === "starting" || r.status === "stopping",
  ).length;

  return { runs, get, start, stop, stopAll, runningCount, startingCount };
}
