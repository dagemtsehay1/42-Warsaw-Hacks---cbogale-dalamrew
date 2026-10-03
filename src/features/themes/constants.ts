export const THEMES = [
  { id: "default", name: "Default", colors: ["#00babc", "#d4a017", "#e35d6a"] },
  { id: "sunset", name: "Sunset", colors: ["#fb7185", "#fbbf24", "#FCD34D"] },
  { id: "emerald", name: "Emerald", colors: ["#34d399", "#2dd4bf", "#FCD34D"] },
  { id: "ocean-violet", name: "Ocean Violet", colors: ["#b49afa", "#5bbcf5", "#FCD34D"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
