export type ProjectIcon = "bookmark" | "globe" | "code" | "box" | "zap" | "leaf";

export type Project = {
  id: string;
  name: string;
  /** Absolute folder path on disk. */
  path: string;
  /** Whatever you'd type in the terminal, e.g. "npm run dev". */
  command: string;
  icon: ProjectIcon;
};

export type LogLine = {
  key: number;
  stream: "stdout" | "stderr";
  text: string;
  /** Set when the line looks like a success/ready banner. */
  ok: boolean;
};

export type RunState = {
  status: "idle" | "starting" | "running" | "stopping" | "error";
  /** Port sniffed out of the dev server's own output. */
  port?: number;
  url?: string;
  logs: LogLine[];
  error?: string;
};

export type Theme = "light" | "dark" | "dusk";
