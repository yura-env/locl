import { useDialKit } from "dialkit";
import type { Transition } from "motion/react";

type DialTransition =
  | { type: "spring"; stiffness?: number; damping?: number; mass?: number; visualDuration?: number; bounce?: number }
  | { type: "easing"; duration: number; ease: [number, number, number, number] };

/** DialKit speaks `{type:'easing'}`; Motion wants `{duration, ease}`. */
export function toMotion(t: DialTransition): Transition {
  if (t.type === "easing") return { duration: t.duration, ease: t.ease };
  const { type: _drop, ...spring } = t;
  return { type: "spring", ...spring };
}

/**
 * Every number in Locl's motion lives here so it can be dialled in live.
 * Open the panel with the DialKit toggle (bottom-right) while `npm run
 * tauri dev` is running, tune, then copy the values back into the defaults.
 */
export function useMotionConfig() {
  const d = useDialKit(
    "Locl Motion",
    {
      panel: {
        enter: { type: "spring", visualDuration: 0.36, bounce: 0.16 } as const,
        offsetY: [10, 0, 40, 1] as [number, number, number, number],
        scaleFrom: [0.975, 0.9, 1, 0.005] as [number, number, number, number],
      },
      rows: {
        enter: { type: "spring", visualDuration: 0.4, bounce: 0.2 } as const,
        stagger: [0.045, 0, 0.2, 0.005] as [number, number, number, number],
        offsetY: [8, 0, 32, 1] as [number, number, number, number],
      },
      // Size changes get their own spring. Entrances can bounce; a box
      // growing to fit its contents should just settle, or the last line of
      // console output makes the whole row wobble.
      layout: {
        transition: { type: "spring", visualDuration: 0.3, bounce: 0 } as const,
      },
      log: {
        enter: { type: "spring", visualDuration: 0.26, bounce: 0 } as const,
        offsetY: [5, 0, 20, 1] as [number, number, number, number],
      },
      press: {
        scale: [0.955, 0.85, 1, 0.005] as [number, number, number, number],
        hoverScale: [1.02, 1, 1.12, 0.005] as [number, number, number, number],
        transition: { type: "spring", visualDuration: 0.18, bounce: 0.32 } as const,
      },
      dot: {
        pulse: true,
        period: [2.2, 0.6, 5, 0.1] as [number, number, number, number],
        spread: [5, 0, 16, 0.5] as [number, number, number, number],
      },
      status: {
        dotPeriod: [1.1, 0.4, 3, 0.05] as [number, number, number, number],
      },
      reduceMotion: false,
    },
    { persist: { key: "locl-motion" } },
  );

  const off = d.reduceMotion;
  const instant: Transition = { duration: 0 };

  return {
    raw: d,
    reduced: off,
    panel: {
      transition: off ? instant : toMotion(d.panel.enter as DialTransition),
      offsetY: off ? 0 : d.panel.offsetY,
      scaleFrom: off ? 1 : d.panel.scaleFrom,
    },
    rows: {
      transition: off ? instant : toMotion(d.rows.enter as DialTransition),
      stagger: off ? 0 : d.rows.stagger,
      offsetY: off ? 0 : d.rows.offsetY,
    },
    layout: {
      transition: off
        ? instant
        : toMotion(d.layout.transition as DialTransition),
    },
    log: {
      transition: off ? instant : toMotion(d.log.enter as DialTransition),
      offsetY: off ? 0 : d.log.offsetY,
    },
    press: {
      scale: off ? 1 : d.press.scale,
      hoverScale: off ? 1 : d.press.hoverScale,
      transition: off ? instant : toMotion(d.press.transition as DialTransition),
    },
    dot: { pulse: d.dot.pulse && !off, period: d.dot.period, spread: d.dot.spread },
    status: { dotPeriod: off ? 0 : d.status.dotPeriod },
  };
}

export type MotionConfig = ReturnType<typeof useMotionConfig>;
