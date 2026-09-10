export const ROLE_OPTIONS = [
  { value: "student", label: "طالبة" },
  { value: "supervisor", label: "دكتورة" },
  { value: "leader_admin", label: "قائدة وحدة الإدارة" },
  { value: "leader_law", label: "قائدة وحدة القانون" },
  { value: "leader_media", label: "قائدة وحدة الإعلام" },
  { value: "leader_accounting", label: "قائدة وحدة المحاسبة" },
  { value: "deputy_admin", label: "نائبة قائدة وحدة الإدارة" },
  { value: "deputy_law", label: "نائبة قائدة وحدة القانون" },
  { value: "deputy_media", label: "نائبة قائدة وحدة الإعلام" },
  { value: "deputy_accounting", label: "نائبة قائدة وحدة المحاسبة" },
];

export const LEADER_ROLES = ["leader_admin", "leader_law", "leader_media", "leader_accounting"];

export function roleLabel(r) {
  if (r === "admin") return "إدارة النادي";
  return ROLE_OPTIONS.find((o) => o.value === r)?.label || "عضوة";
}

export function canManageClub(role) {
  return role === "admin" || role === "supervisor" || LEADER_ROLES.includes(role);
}

export function isDoctorOrAdmin(role) {
  return role === "supervisor" || role === "admin";
}
