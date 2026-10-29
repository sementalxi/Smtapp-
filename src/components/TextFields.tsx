"use client";

import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";
import { BannerInputs, LAYOUT_FIELDS, LayoutKind } from "@/lib/templates";

const MAX: Partial<Record<keyof BannerInputs, number>> = {
  name: 40,
  team: 40,
  position: 24,
  number: 4,
  tagline: 30,
  subtitle: 40,
  footer: 48,
  headline: 30,
  eventName: 48,
  prize: 24,
  date: 30,
  details: 48,
};

export function TextFields({
  layout,
  value,
  onChange,
}: {
  layout: LayoutKind;
  value: BannerInputs;
  onChange: (v: BannerInputs) => void;
}) {
  const { t } = useT();
  const set = <K extends keyof BannerInputs>(k: K, v: BannerInputs[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {LAYOUT_FIELDS[layout].map((key) => {
        const labelKey: DictKey = layout === "EVENT" && key === "name" ? "title_name" : (`f_${key}` as DictKey);
        if (Array.isArray(value[key])) {
          return (
            <div key={key} className="sm:col-span-2">
              <label className="label">{t(labelKey)}</label>
              <textarea
                className="input min-h-36 font-mono"
                value={(value[key] as string[]).join("\n")}
                onChange={(e) => set(key, e.target.value.split("\n").slice(0, 30).map((s) => s.slice(0, 40)) as never)}
              />
            </div>
          );
        }
        return (
          <div key={key} className={key === "name" || key === "headline" ? "sm:col-span-2" : ""}>
            <label className="label">{t(labelKey)}</label>
            <input
              className="input"
              value={value[key] as string}
              maxLength={MAX[key] ?? 40}
              onChange={(e) => set(key, e.target.value as never)}
            />
          </div>
        );
      })}
    </div>
  );
}
