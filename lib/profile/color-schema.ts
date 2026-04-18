import { z } from "zod";

export const PROFILE_COLORS = [
  "orange",
  "blue",
  "gold",
  "violet",
  "green",
  "rose",
] as const;

export type ProfileColor = (typeof PROFILE_COLORS)[number];

export const profileColorSchema = z.enum(PROFILE_COLORS);
