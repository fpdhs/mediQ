import { validateAuthConfiguration } from './auth.js';

// Authentication changes must not alter the existing Data Plane trust boundary.
export function validateCapstoneControlRuntime(env = process.env) {
  if (env.HIPASS_CONTROL_PLANE_ONLY !== '1' || env.HIPASS_DPOP_REQUIRED !== '1'
      || env.HIPASS_STORE !== 'postgres' || env.NODE_ENV !== 'production'
      || !['TEST', 'ENTRA_OIDC'].includes(env.AUTH_MODE)) {
    throw new Error('Capstone cloud boundary configuration required');
  }
  if (env.AUTH_MODE === 'ENTRA_OIDC') {
    if (env.HIPASS_CAPSTONE_MOCK_IDP === '1') throw new Error('ENTRA_MOCK_IDP_FORBIDDEN');
    validateAuthConfiguration(env);
  }
}
