import { z } from "zod";

export const StyleSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  dark: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  nameFont: z.enum(["anton", "bebas", "gothic", "brush", "sans"]),
  scriptFont: z.enum(["anton", "bebas", "gothic", "brush", "sans"]),
  nameGradient: z.array(z.string()).min(1).max(6),
  fallback: z.array(z.string()).length(3),
  particles: z.enum(["sparks", "embers", "snow", "none"]),
  ghost: z.boolean(),
  giantText: z.boolean(),
  streaks: z.boolean(),
});

export const TemplateSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(1).max(40),
  nameEs: z.string().trim().min(1).max(40),
  layout: z.enum(["PLAYER", "CHAMPIONS", "EVENT"]),
  prompt: z.string().trim().min(10).max(1000),
  style: StyleSchema,
  cost: z.number().int().min(0).max(50),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000),
  styleRefUrl: z.string().max(500).nullable().optional(),
});
