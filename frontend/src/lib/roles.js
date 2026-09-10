export const ROLE_OPTIONS = [
  { value: "student", label: "طالبة" },
  { value: "supervisor", label: "دكتورة" },
  { value: "club_leader", label: "قائدة نادي مصباح" },
  { value: "leader_law", label: "قائدة وحدة القانون" },
  { value: "leader_admin", label: "قائدة وحدة الإدارة" },
  { value: "leader_accounting", label: "قائدة وحدة المحاسبة" },
  { value: "leader_media", label: "قائدة وحدة الإعلام" },
  { value: "deputy_law", label: "نائبة قائدة وحدة القانون" },
  { value: "deputy_admin", label: "نائبة قائدة وحدة الإدارة" },
  { value: "deputy_accounting", label: "نائبة قائدة وحدة المحاسبة" },
  { value: "deputy_media", label: "نائبة قائدة وحدة الإعلام" },
];

export const CLUB_LEADER = "club_leader";
export const LEADER_ROLES = ["leader_admin", "leader_law", "leader_media", "leader_accounting"];
export const DEPUTY_ROLES = ["deputy_admin", "deputy_law", "deputy_media", "deputy_accounting"];

const MANAGER_ROLES = ["admin", "supervisor", CLUB_LEADER, ...LEADER_ROLES];
const EVENT_STAFF_ROLES = [...MANAGER_ROLES, ...DEPUTY_ROLES];

export function roleLabel(r) {
  if (r === "admin") return "إدارة النادي";
  return ROLE_OPTIONS.find((o) => o.value === r)?.label || "عضوة";
}

// إضافة فعاليات + رؤية الحضور + QR (الإدارة + الدكاترة + القائدات + النواب)
export function canManageEvents(role) {
  return EVENT_STAFF_ROLES.includes(role);
}

// إدارة كاملة تشمل حذف الفعاليات (بدون النواب)
export function canManageClub(role) {
  return MANAGER_ROLES.includes(role);
}

export function isDoctorOrAdmin(role) {
  return role === "supervisor" || role === "admin";
}
