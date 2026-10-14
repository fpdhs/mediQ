// Fixed, same-origin destinations only. Never accept a return URL from query input.
export function loginHomePath(pathname = '') {
  return /^\/mobile(?:\/|$)/u.test(pathname) ? '/mobile/' : '/hipass/';
}
export function loginIntentFromSearch(search = '') {
  if (typeof search !== 'string') return null;
  const params = new URLSearchParams(search);
  if (params.size !== 1 || params.getAll('loginIntent').length !== 1 || params.get('loginIntent') !== 'security') return null;
  return 'SECURITY_ADMIN';
}
export function isSecurityAdminSession(session) {
  return Array.isArray(session?.roles) && session.roles.length === 1 && session.roles[0] === 'SECURITY_ADMIN';
}
export function loginReturnUrl(origin, pathname, loginIntent = null) {
  if (pathname === '/single-import-check.html') return new URL(pathname, origin).href;
  const destination = new URL(loginHomePath(pathname), origin);
  if (loginIntent === 'SECURITY_ADMIN') destination.searchParams.set('loginIntent', 'security');
  return destination.href;
}
export function requiresEntra(hostname) {
  return hostname === 'highpass-demo.japaneast.cloudapp.azure.com';
}
