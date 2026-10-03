import { hasDatabase, migrate, query } from "@/lib/db/pool";
import { isThemeId, type ThemeId } from "./constants";

export async function readTheme(): Promise<ThemeId> {
  if (!hasDatabase()) return "default";
  try {
    await migrate();
    const rows = await query<{ theme: string }>(
      "SELECT theme FROM dashboard_theme WHERE id = 1",
    );
    return isThemeId(rows[0]?.theme) ? rows[0].theme : "default";
  } catch (error) {
    console.error("[theme] Unable to read saved theme:", error);
    return "default";
  }
}

export async function saveTheme(theme: ThemeId): Promise<void> {
  if (!isThemeId(theme)) throw new Error("Invalid theme");
  await migrate();
  await query(
    `INSERT INTO dashboard_theme (id, theme) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET theme = EXCLUDED.theme, updated_at = now()`,
    [theme],
  );
}
