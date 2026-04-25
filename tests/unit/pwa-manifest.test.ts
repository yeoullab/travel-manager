import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const ManifestSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().min(1).max(12),
  description: z.string().min(1),
  start_url: z.string().startsWith("/"),
  scope: z.string().startsWith("/"),
  display: z.enum(["standalone", "fullscreen", "minimal-ui", "browser"]),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lang: z.string(),
  icons: z
    .array(
      z.object({
        src: z.string(),
        sizes: z.string(),
        type: z.string(),
        purpose: z.enum(["any", "maskable", "monochrome"]).optional(),
      }),
    )
    .min(2),
});

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(resolve("public/manifest.webmanifest"), "utf-8"),
  );

  it("matches schema", () => {
    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
  });

  it("includes a maskable 512×512 icon", () => {
    const maskable = manifest.icons.find(
      (i: { sizes: string; purpose?: string }) =>
        i.sizes === "512x512" && i.purpose === "maskable",
    );
    expect(maskable).toBeDefined();
  });

  it("theme_color matches viewport themeColor in app/layout.tsx", () => {
    const layout = readFileSync(resolve("app/layout.tsx"), "utf-8");
    const m = layout.match(/themeColor:\s*["']([^"']+)["']/);
    expect(m?.[1]).toBe(manifest.theme_color);
  });

  it("start_url and scope are root", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });
});
