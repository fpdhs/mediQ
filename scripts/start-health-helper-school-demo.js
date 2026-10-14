const conflictingModes = [
  'HIPASS_HEALTH_EDUCATION',
  'HIPASS_AFP_EVIDENCE',
  'HIPASS_LIVER_EVIDENCE',
  'HIPASS_IMAGING_EVIDENCE',
  'HIPASS_SCENARIO_EVIDENCE',
];
if (conflictingModes.some(name => process.env[name] === '1')) {
  throw new Error('SCHOOL_DEMO_MODE_CONFLICT');
}

process.env.HIPASS_HEALTH_HELPER_SCHOOL_DEMO = '1';
process.env.HIPASS_MEDLINEPLUS_PREVIEW_PORT ??= '11445';
process.env.HIPASS_MEDLINEPLUS_UPLOADED = '1';
process.env.HIPASS_HEALTH_HELPER_SCHOOL_BIND_ADDRESS ??= '127.0.0.1';
process.env.HIPASS_HEALTH_HELPER_SCHOOL_PUBLIC_HOST ??= '127.0.0.1';

await import('./medlineplus-local-preview.js');
