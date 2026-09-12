import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { AnimatePresence, motion } from "motion/react";
import { DialRoot } from "dialkit";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { FolderOpen, Moon, Plus, Sun } from "lucide-react";
import { useProjects } from "./lib/useProjects";
import { useRunner } from "./lib/useRunner";
import { useMotionConfig } from "./lib/useMotionConfig";
import { ProjectRow } from "./components/ProjectRow";
import { Logo } from "./components/Logo";
import type { Theme } from "./types";

const PAD = 12; // breathing room so the panel shadow isn't clipped
const MIN_H = 220;
const MAX_H = 840;

// In production the window hugs the panel like a tray popover. In dev it
// needs slack, or DialKit's control panel has nowhere to open.
const DEV = import.meta.env.DEV;
const WIDTH = DEV ? 1180 : 484;

const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "dusk",
  dusk: "light",
};

const THEME_ICON = { light: Sun, dark: Moon, dusk: Moon } as const;

export default function App() {
  const { projects, ready, theme, setTheme, addProjects, update, remove } =
    useProjects();
  const { get, start, stop, stopAll, runningCount, startingCount } =
    useRunner();
  const m = useMotionConfig();
  const panel = useRef<HTMLDivElement>(null);
  // Read from the bundle rather than hardcoded, so it can't drift from the
  // version people actually installed.
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v.replace(/\.0$/, "")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // The panel is a popover, so it should be exactly as tall as its contents.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const win = getCurrentWindow();
    if (DEV) {
      // Centred rather than tray-parked: the dev window is far wider than the
      // panel and would hang off the right edge of the screen.
      win
        .setSize(new LogicalSize(WIDTH, 900))
        .then(() => win.center())
        .catch(() => {});
      return;
    }
    let last = 0;
    const ro = new ResizeObserver(() => {
      const h = Math.min(
        MAX_H,
        Math.max(MIN_H, Math.ceil(el.getBoundingClientRect().height) + PAD * 2),
      );
      if (Math.abs(h - last) < 2) return;
      last = h;
      // Re-park after every resize, or the panel walks up the screen: a
      // resize keeps the window's top-left corner fixed, not its bottom.
      win
        .setSize(new LogicalSize(WIDTH, h))
        .then(() => invoke("park"))
        .catch(() => {});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // Anything mid-flight mutes the header: green is reserved for actually up.
  const busy = startingCount > 0;
  const ThemeIcon = THEME_ICON[theme];

  return (
    <div
      className={`flex h-full w-full justify-center ${
        DEV ? "items-center rounded-2xl" : "items-start"
      }`}
      // The window is transparent, so in dev a faint ground makes the
      // working area (and DialKit's toggle) visible against the desktop.
      style={{ padding: PAD, background: DEV ? "#00000073" : "transparent" }}
    >
      <motion.div
        ref={panel}
        initial={{ opacity: 0, y: m.panel.offsetY, scale: m.panel.scaleFrom }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={m.panel.transition}
        className="flex w-[460px] flex-col overflow-hidden rounded-[28px]"
        style={{
          background: "var(--app-bg)",
          boxShadow: "var(--panel-shadow)",
        }}
      >
        {/* Header, also the window's drag handle. */}
        <header
          data-tauri-drag-region
          className="flex w-full items-center gap-[3px] px-6 pt-5 pb-4"
        >
          <Logo />
          <span
            data-tauri-drag-region
            className="text-[15px] leading-[23px] font-semibold tracking-[-0.37px]"
            style={{ color: "var(--text)" }}
          >
            Locl
          </span>
          {version && (
            <span
              data-tauri-drag-region
              className="ml-1.5 font-mono text-[10px] leading-4 font-medium"
              style={{ color: "var(--status)" }}
            >
              v{version}
            </span>
          )}
        </header>

        {/* Card */}
        <div className="flex w-full flex-col items-center">
          <div
            className="flex w-[440px] flex-col rounded-[22px] p-2.5"
            style={{ background: "var(--card)" }}
          >
            <div className="flex w-full items-center justify-between px-2 pt-1 pb-3">
              <span
                className="text-[11px] leading-[17px] font-medium"
                style={{ color: "var(--text-3)" }}
              >
                Projects {String(projects.length).padStart(2, "0")}
              </span>
              <motion.button
                type="button"
                onClick={addProjects}
                whileTap={{ scale: m.press.scale }}
                whileHover={{ scale: m.press.hoverScale }}
                transition={m.press.transition}
                className="flex items-center gap-1"
                style={{ color: "var(--text-2)" }}
              >
                <Plus size={12} strokeWidth={1.6} />
                <span className="text-[11px] leading-[17px] font-medium">
                  Add project
                </span>
              </motion.button>
            </div>

            <div className="scroll-thin flex max-h-[520px] w-full flex-col gap-1 overflow-y-auto">
              {ready && projects.length === 0 && (
                <motion.button
                  type="button"
                  onClick={addProjects}
                  initial={{ opacity: 0, y: m.rows.offsetY }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={m.rows.transition}
                  className="flex w-full flex-col items-center gap-2 rounded-[12px] border border-dashed px-4 py-8"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  <FolderOpen
                    size={18}
                    strokeWidth={1.4}
                    style={{ color: "var(--text-4)" }}
                  />
                  <span
                    className="text-[12px] leading-[18px] font-medium"
                    style={{ color: "var(--text-2)" }}
                  >
                    Import your project folders
                  </span>
                  <span
                    className="text-[10.5px] leading-[16px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    Pick one or many. Locl remembers them.
                  </span>
                </motion.button>
              )}

              <AnimatePresence initial={false}>
                {projects.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: m.rows.offsetY }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{
                      ...m.rows.transition,
                      delay: i * m.rows.stagger,
                      // Entrance may bounce; resizing must not.
                      layout: m.layout.transition,
                    }}
                  >
                    <ProjectRow
                      project={p}
                      run={get(p.id)}
                      m={m}
                      onStart={() => start(p)}
                      onStop={() => stop(p.id)}
                      onUpdate={(patch) => update(p.id, patch)}
                      onRemove={() => remove(p.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex w-full items-center justify-between gap-3 px-6 pt-4 pb-5">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={busy ? "busy" : runningCount}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={m.log.transition}
              className="flex items-center gap-1.5 text-[12px] leading-[18px] font-medium tracking-[-0.3px]"
              style={{
                color: "var(--status)",
                ["--dot-period" as string]: `${m.status.dotPeriod}s`,
              }}
            >
              {busy ? (
                <>
                  {startingCount > 1 ? `${startingCount} starting` : "starting"}
                  <span className="locl-dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                </>
              ) : runningCount ? (
                `${runningCount} running`
              ) : projects.length ? (
                "idle"
              ) : (
                ""
              )}
            </motion.span>
          </AnimatePresence>

          <span className="flex items-center gap-3">
            <motion.button
              type="button"
              title={`Theme: ${theme} (click to switch)`}
              onClick={() => setTheme(NEXT_THEME[theme])}
              whileTap={{ scale: m.press.scale }}
              whileHover={{ scale: m.press.hoverScale }}
              transition={m.press.transition}
              className="flex items-center"
              style={{ color: "var(--status)" }}
            >
              <ThemeIcon size={12} strokeWidth={1.5} />
            </motion.button>

            <motion.button
              type="button"
              disabled={!runningCount}
              onClick={stopAll}
              whileTap={{ scale: runningCount ? m.press.scale : 1 }}
              whileHover={{ scale: runningCount ? m.press.hoverScale : 1 }}
              transition={m.press.transition}
              className="text-[11px] leading-[17px] font-medium transition-opacity"
              style={{
                color: "var(--text-2)",
                opacity: runningCount ? 1 : 0.45,
              }}
            >
              Stop all
            </motion.button>
          </span>
        </footer>
      </motion.div>

      <DialRoot position="bottom-left" theme="system" />
    </div>
  );
}
