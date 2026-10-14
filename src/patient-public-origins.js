export const PATIENT_APP_ORIGIN = 'https://highpass-demo.japaneast.cloudapp.azure.com';
export const PATIENT_IMAGE_ORIGIN = 'https://highpass-images-b.japaneast.cloudapp.azure.com';

// Explicit pair, never Host/Forwarded/client supplied. Legacy doctor origins stay unchanged.
export function patientPublicOrigins(env, legacyOrigin) {
  const issuance = env.HIPASS_PATIENT_ISSUANCE_ORIGIN;
  const images = env.HIPASS_PATIENT_IMAGE_ORIGIN;
  if (!issuance && !images) return { issuance: legacyOrigin, images: legacyOrigin };
  if (issuance !== PATIENT_APP_ORIGIN || images !== PATIENT_IMAGE_ORIGIN)
    throw new Error('PATIENT_PUBLIC_ORIGIN_PAIR_INVALID');
  return { issuance, images };
}

export function patientRequestOrigin(path, env, legacyOrigin) {
  if (path === '/api/dicom-access/request' && env.AUTH_MODE === 'ENTRA_OIDC') {
    return patientPublicOrigins(env, legacyOrigin).issuance;
  }
  return (/^\/api\/patients\/[^/?]+\/studies\/[^/?]+\/self-view-grants$/.test(path)
    || path==='/api/demo/qr/redeem')
    ? patientPublicOrigins(env, legacyOrigin).issuance : legacyOrigin;
}
