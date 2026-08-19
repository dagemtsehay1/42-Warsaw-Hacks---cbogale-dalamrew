"use server";

import { revalidatePath } from "next/cache";
import { currentStaff } from "@/lib/auth/current-user";
import {
  ALLOWED_SLIDE_TYPES,
  MAX_SLIDE_BYTES,
} from "@/features/slides/constants";
import {
  createSlide,
  deleteSlide,
  setSlideActive,
} from "@/features/slides/repository";
import { deleteTeammateRequestById } from "@/features/teammates/repository";

/**
 * Every action re-checks `currentStaff()` server-side. Hiding the admin UI from
 * non-staff is presentation; this is the actual gate, and it is the one that
 * matters because a server action is a public endpoint.
 */

export type UploadResult = { error?: string; ok?: boolean };

export async function uploadSlide(
  _prev: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  const staff = await currentStaff();
  if (!staff) return { error: "Not authorised." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }
  if (!ALLOWED_SLIDE_TYPES.includes(file.type)) {
    return { error: `That file type isn't supported (${file.type || "unknown"}).` };
  }
  if (file.size > MAX_SLIDE_BYTES) {
    return {
      error: `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_SLIDE_BYTES / 1024 / 1024}MB.`,
    };
  }

  const title =
    String(formData.get("title") ?? "").trim().slice(0, 120) ||
    file.name.replace(/\.[^.]+$/, "");

  await createSlide({
    title,
    contentType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
    uploadedBy: staff.login,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleSlide(formData: FormData) {
  if (!(await currentStaff())) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await setSlideActive(id, formData.get("active") === "true");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function removeSlide(formData: FormData) {
  if (!(await currentStaff())) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await deleteSlide(id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function removeTeammatePost(formData: FormData) {
  if (!(await currentStaff())) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await deleteTeammateRequestById(id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
