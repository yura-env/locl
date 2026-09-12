import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Folder,
  LoaderCircle,
  Play,
  Square,
  Trash,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Project, RunState } from "../types";
import type { MotionConfig } from "../lib/useMotionConfig";
import { ProjectGlyph } from "./ProjectGlyph";
import { TerminalBlock } from "./TerminalBlock";
import { ICON_NAMES } from "./ProjectGlyph";

/** `C:\Users\me\Projects\x` reads better as `~\Projects\x` at 10px. */
function pretty(path: string) {
  return path.replace(/^([A-Za-z]:)?[\\/]Users[\\/][^\\/]+/i, "~");
}

export function ProjectRow({
  project,
  run,
  m,
  onStart,
  onStop,
  onUpdate,
  onRemove,
}: {
  project: Project;
  run: RunState;
  m: MotionConfig;
  onStart: () => void;
  onStop: () => void;
  onUpdate: (patch: Partial<Project>) => void;
  onRemove: () => void;
}) {
  const busy = run.status === "starting" || run.status === "stopping";
  const live = run.status === "running" || run.status === "starting";
  const [openDetails, setOpenDetails] = useState(false);

  // A running project always shows its output; a stopped one only when asked.
  const expanded = live || openDetails;

  const press = {
    whileTap: { scale: m.press.scale },
    whileHover: { scale: m.press.hoverScale },
    transition: m.press.transition,
  };

  return (
    <motion.div
      layout
      transition={m.layout.transition}
      className="w-full overflow-hidden rounded-[12px]"
      style={{ background: expanded ? "var(--row)" : "transparent" }}
    >
      <div className="flex w-full items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpenDetails((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[6px] text-left"
        >
          <ProjectGlyph icon={project.icon} live={live} />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span
                className="truncate text-[13px] leading-5 font-medium tracking-[-0.32px]"
                style={{ color: "var(--text)" }}
              >
                {project.name}
              </span>
              <motion.span
                animate={{ rotate: openDetails ? 180 : 0 }}
                transition={m.press.transition}
                className="flex shrink-0"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.6}
                  style={{ color: "var(--text-4)" }}
                />
              </motion.span>
            </span>
            <span
              className="truncate font-mono text-[10px] leading-4"
              style={{ color: "var(--text-3)" }}
            >
              {run.status === "error"
                ? (run.error ?? "Failed")
                : run.port
                  ? `localhost:${run.port}`
                  : live
                    ? "starting…"
                    : pretty(project.path)}
            </span>
          </span>
        </button>

        <motion.button
          {...press}
          type="button"
          disabled={busy}
          onClick={live ? onStop : onStart}
          className="flex h-7 w-[65px] shrink-0 items-center justify-center gap-1.5 rounded-full"
          style={{
            background: live ? "var(--stop-bg)" : "var(--btn)",
            color: live ? "var(--stop-fg)" : "var(--btn-fg)",
          }}
        >
          {busy ? (
            <LoaderCircle size={11} strokeWidth={2} className="animate-spin" />
          ) : live ? (
            <Square size={8} strokeWidth={0} fill="currentColor" />
          ) : (
            <Play size={9} strokeWidth={0} fill="currentColor" />
          )}
          <span className="text-[11px] leading-[17px] font-medium">
            {live ? "Stop" : "Start"}
          </span>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            // "auto" is re-measured on every render, so each new console line
            // re-runs this spring. A bouncy one wobbles the row as output
            // streams in. This is the settle that looked wrong.
            transition={m.layout.transition}
            className="overflow-hidden"
          >
            <div className="flex flex-col px-3 pb-3">
              <div
                className="flex items-center gap-1.5 border-t pt-[13px]"
                style={{ borderColor: "var(--line)" }}
              >
                <Folder
                  size={11}
                  strokeWidth={1.25}
                  className="shrink-0"
                  style={{ color: "var(--text-4)" }}
                />
                <span
                  className="truncate font-mono text-[10px] leading-[15px]"
                  style={{ color: "var(--text-3)" }}
                  title={project.path}
                >
                  {pretty(project.path)}
                </span>
              </div>

              <div className="h-3" />

              {live || run.logs.length > 0 ? (
                <TerminalBlock
                  command={project.command}
                  logs={run.logs}
                  m={m}
                />
              ) : (
                <EditStrip
                  project={project}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  press={press}
                />
              )}

              {/* While a server is coming up or going down the footer already
                  says so, and the terminal above shows the detail, so repeating
                  "Starting…" here just said the same thing twice. */}
              {!busy && (
                <>
                  <div className="h-2.5" />

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <StatusDot run={run} m={m} />
                      <span
                        className="text-[10px] leading-[15px]"
                        style={{ color: "var(--text-3)" }}
                      >
                        {run.status === "running"
                          ? "Server ready"
                          : run.status === "error"
                            ? "Stopped with errors"
                            : "Not running"}
                      </span>
                    </span>

                    {run.url && (
                      <motion.button
                        {...press}
                        type="button"
                        onClick={() => run.url && openUrl(run.url)}
                        className="flex items-center gap-1"
                        style={{ color: "var(--link)" }}
                      >
                        <span className="text-[11px] leading-[17px] font-medium">
                          Open in browser
                        </span>
                        <ArrowUpRight size={12} strokeWidth={1.6} />
                      </motion.button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusDot({ run, m }: { run: RunState; m: MotionConfig }) {
  const color =
    run.status === "running"
      ? "var(--run)"
      : run.status === "error"
        ? "var(--text-4)"
        : "var(--text-4)";

  const pulsing = run.status === "running" && m.dot.pulse;

  return (
    <motion.span
      className="h-[5px] w-[5px] shrink-0 rounded-full"
      style={{ background: color }}
      animate={
        pulsing
          ? {
              boxShadow: [
                `0 0 0 0 ${"color-mix(in srgb, var(--run) 45%, transparent)"}`,
                `0 0 0 ${m.dot.spread}px color-mix(in srgb, var(--run) 0%, transparent)`,
              ],
            }
          : { boxShadow: "0 0 0 0 transparent" }
      }
      transition={
        pulsing
          ? { duration: m.dot.period, repeat: Infinity, ease: "easeOut" }
          : { duration: 0.2 }
      }
    />
  );
}

function EditStrip({
  project,
  onUpdate,
  onRemove,
  press,
}: {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
  onRemove: () => void;
  press: Record<string, unknown>;
}) {
  const [name, setName] = useState(project.name);
  const [command, setCommand] = useState(project.command);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Field
          value={name}
          onChange={setName}
          onCommit={() => onUpdate({ name: name.trim() || project.name })}
          mono={false}
          label="Name"
        />
        <Field
          value={command}
          onChange={setCommand}
          onCommit={() => onUpdate({ command: command.trim() || "npm run dev" })}
          mono
          label="Command"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {ICON_NAMES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onUpdate({ icon: n })}
              className="flex h-5 w-5 items-center justify-center rounded-[6px] transition-opacity"
              style={{
                background:
                  project.icon === n ? "var(--run-icon-bg)" : "var(--icon-bg)",
                opacity: project.icon === n ? 1 : 0.55,
              }}
            >
              {project.icon === n ? (
                <Check
                  size={10}
                  strokeWidth={2}
                  style={{ color: "var(--run-icon)" }}
                />
              ) : (
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{ background: "var(--text-4)" }}
                />
              )}
            </button>
          ))}
        </div>

        <motion.button
          {...press}
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-full px-2 py-1"
          style={{ color: "var(--text-3)" }}
        >
          <Trash size={11} strokeWidth={1.5} />
          <span className="text-[10px] leading-[15px] font-medium">Remove</span>
        </motion.button>
      </div>
    </div>
  );
}

function Field({
  value,
  onChange,
  onCommit,
  mono,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  mono: boolean;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`selectable min-w-0 flex-1 rounded-lg border px-2.5 py-[7px] text-[10.5px] leading-[16px] outline-none ${
        mono ? "font-mono" : ""
      }`}
      style={{
        background: "var(--term)",
        borderColor: "var(--line-strong)",
        color: "var(--text-2)",
      }}
    />
  );
}
