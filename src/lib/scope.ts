import "server-only";
import { Site } from "@/models";
import { isSiteScoped } from "./roles";
import type { SessionUser } from "./jwt";
import { ApiError } from "./api";

/**
 * For site engineers / supervisors, returns the list of site ids they are assigned to.
 * Returns null for office roles (no restriction).
 */
export async function allowedSiteIds(user: SessionUser): Promise<string[] | null> {
  if (!isSiteScoped(user.role)) return null;
  const sites = await Site.find({ assignedUsers: user.id }).select("_id").lean<any[]>();
  return sites.map((s) => String(s._id));
}

export async function assertSiteAccess(user: SessionUser, siteId: string) {
  const ids = await allowedSiteIds(user);
  if (ids && !ids.includes(String(siteId))) throw new ApiError(403, "You are not assigned to this site");
}
