"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import {
  addTeammateRequest,
  removeTeammateRequest,
} from "@/features/teammates/repository";

/**
 * Both actions re-read the session server-side rather than trusting anything
 * the form sends. The form supplies which *project*; who is being listed always
 * comes from the cookie, so there is no shape of request that lists or removes
 * somebody else.
 */

function parseProject(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) return null;

  return {
    projectId,
    projectName: String(formData.get("projectName") ?? "").slice(0, 200),
    projectSlug: String(formData.get("projectSlug") ?? "").slice(0, 200),
  };
}

export async function addListing(formData: FormData) {
  const user = await currentUser();
  if (!user) return;

  const project = parseProject(formData);
  if (!project || !project.projectName) return;

  await addTeammateRequest(user, project);
  revalidatePath("/teammate");
  revalidatePath("/dashboard");
}

export async function removeListing(formData: FormData) {
  const user = await currentUser();
  if (!user) return;

  const project = parseProject(formData);
  if (!project) return;

  await removeTeammateRequest(user.id, project.projectId);
  revalidatePath("/teammate");
  revalidatePath("/dashboard");
}
