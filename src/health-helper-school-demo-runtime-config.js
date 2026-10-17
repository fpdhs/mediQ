export const SCHOOL_DEMO_LAN_PORTS = Object.freeze(['11444', '11445', '11446']);

export function resolveSchoolDemoLanPort(value) {
  const port = value ?? '11446';
  if (!SCHOOL_DEMO_LAN_PORTS.includes(port)) throw new Error('SCHOOL_DEMO_PORT_INVALID');
  return port;
}
