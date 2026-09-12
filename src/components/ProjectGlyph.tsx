import { Bookmark, Box, CodeXml, Globe, Leaf, Zap } from "lucide-react";
import type { ProjectIcon } from "../types";

const GLYPHS = {
  bookmark: Bookmark,
  globe: Globe,
  code: CodeXml,
  box: Box,
  zap: Zap,
  leaf: Leaf,
} as const;

export const ICON_NAMES = Object.keys(GLYPHS) as ProjectIcon[];

export function ProjectGlyph({
  icon,
  live,
}: {
  icon: ProjectIcon;
  live: boolean;
}) {
  const Glyph = GLYPHS[icon] ?? Box;
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-200"
      style={{
        background: live ? "var(--run-icon-bg)" : "var(--icon-bg)",
      }}
    >
      <Glyph
        size={15}
        strokeWidth={1.4}
        style={{ color: live ? "var(--run-icon)" : "var(--text-3)" }}
      />
    </span>
  );
}
