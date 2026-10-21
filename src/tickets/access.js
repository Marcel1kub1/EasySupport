export function hasTicketAccessRole(member, roleId) {
  if (!roleId) return false;

  const roles = member?.roles;
  if (roles?.cache?.has) return roles.cache.has(roleId);
  return Array.isArray(roles) && roles.includes(roleId);
}
