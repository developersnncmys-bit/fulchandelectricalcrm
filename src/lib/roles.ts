// Client-safe role & permission definitions (no server imports here).

export const ROLES = ["admin", "management", "accounts", "site_engineer", "site_supervisor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  management: "Management",
  accounts: "Accounts Team",
  site_engineer: "Site Engineer",
  site_supervisor: "Site Supervisor",
};

const ALL: Role[] = [...ROLES];
const OFFICE: Role[] = ["admin", "management", "accounts"];

export const PERMISSIONS = {
  "dashboard.view": OFFICE,
  "work.view": ALL,
  "work.create": ["admin", "accounts", "site_engineer", "site_supervisor"],
  "work.validate": ["admin", "site_engineer"],
  "masters.view": ALL,
  "masters.edit": ["admin", "accounts"],
  "po.view": ["admin", "management", "accounts", "site_engineer"],
  "po.edit": ["admin", "accounts"],
  "po.status": ["admin", "accounts", "management"],
  "invoice.view": OFFICE,
  "invoice.edit": ["admin", "accounts"],
  "payment.view": OFFICE,
  "payment.edit": ["admin", "accounts"],
  "reports.view": OFFICE,
  "documents.view": ALL,
  "documents.upload": ["admin", "accounts", "site_engineer", "site_supervisor"],
  "documents.delete": ["admin", "accounts"],
  "users.manage": ["admin"],
  "settings.manage": ["admin"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] as Role[]).includes(role);
}

/** Roles restricted to sites they are assigned to. */
export function isSiteScoped(role: Role) {
  return role === "site_engineer" || role === "site_supervisor";
}

export function homeFor(role: Role) {
  return can(role, "dashboard.view") ? "/dashboard" : "/work-entries";
}
