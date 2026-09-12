import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import type { LogLine } from "../types";
import type { MotionConfig } from "../lib/useMotionConfig";

/** Newest lines only. The block is a status readout, not a full terminal. */
const VISIBLE = 40;

export function TerminalBlock({
  command,
  logs,
  m,
}: {
  command: string;
  logs: LogLine[];
  m: MotionConfig;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const tail = logs.slice(-VISIBLE);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div
      ref={scroller}
      className="scroll-thin selectable max-h-[104px] w-full overflow-y-auto rounded-lg border px-[13px] py-[11px]"
      style={{ background: "var(--term)", borderColor: "var(--line-strong)" }}
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2">
          <span
            className="font-mono text-[10.5px] leading-[18px] tracking-[-0.2px]"
            style={{ color: "var(--text-3)" }}
          >
            $
          </span>
          <span
            className="font-mono text-[10.5px] leading-[18px] tracking-[-0.2px]"
            style={{ color: "var(--text-2)" }}
          >
            {command}
          </span>
        </p>

        <AnimatePresence initial={false}>
          {tail.map((line) => (
            <motion.p
              key={line.key}
              layout="position"
              initial={{ opacity: 0, y: m.log.offsetY }}
              animate={{ opacity: 1, y: 0 }}
              transition={m.log.transition}
              className="flex items-start gap-1.5"
            >
              {line.ok && (
                <Check
                  size={11}
                  strokeWidth={1.6}
                  className="mt-[3.5px] shrink-0"
                  style={{ color: "var(--run-icon)" }}
                />
              )}
              <span
                className="font-mono text-[10.5px] leading-[18px] tracking-[-0.2px] break-all whitespace-pre-wrap"
                style={{
                  color: line.ok
                    ? "var(--run-icon)"
                    : line.stream === "stderr"
                      ? "var(--text-2)"
                      : "var(--text-3)",
                }}
              >
                {line.text}
              </span>
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
