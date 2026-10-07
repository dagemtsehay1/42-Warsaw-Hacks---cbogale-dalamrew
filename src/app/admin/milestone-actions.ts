"use server";

import { revalidatePath } from "next/cache";
import { currentStaff } from "@/lib/auth/current-user";
import { MilestoneValidationError, saveMilestoneSettings } from "@/features/milestones/repository";

export async function updateMilestones(paths: unknown, version: number): Promise<{ error?: string; version?: number }> {
  if (!(await currentStaff())) return { error: "Not authorised." };
  try {
    const nextVersion = await saveMilestoneSettings(paths, version);
    revalidatePath("/admin");
    return { version: nextVersion };
  } catch (error) {
    if (error instanceof MilestoneValidationError) return { error: error.message };
    console.error("[milestones] Unable to save settings:", error);
    return { error: "Could not save milestone settings. Please try again." };
  }
}
