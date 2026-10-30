import { z } from "zod";

export const DealSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(300).default(""),
  price: z.string().trim().max(30).default(""),
  tags: z.string().trim().max(120).default(""),
  included: z.string().trim().max(1500).default(""),
  imageUrl: z.string().max(500).nullish(),
  ctaLabel: z.string().trim().max(40).default(""),
  // Only links inside the site ("/pricing") or https links.
  ctaHref: z.string().trim().max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a link like /pricing or https://…").default("/pricing"),
  endsAt: z.string().max(40).nullish(),
  active: z.boolean().default(true),
  sort: z.number().int().min(0).max(9999).default(0),
});
