import { createHash } from 'node:crypto';
import { EntraOidcProvider } from './auth.js';

// Server configuration only. Re-read the protected actor map for every policy
// check (including grant use); never accept an email or binding from HTTP input.
export function createPatientEntraOwnershipResolver(env) {
  if (env.AUTH_MODE !== 'ENTRA_OIDC') return null;
  return principal => {
    const provider = new EntraOidcProvider(env);
    const matches = [...provider.actorMap.entries()].filter(([, actor]) =>
      actor.role === 'PATIENT' && actor.actorId === principal?.subject
      && actor.patientId === principal?.patientId);
    if (matches.length !== 1 || principal.subject !== 'synthetic-patient-hcc'
      || principal.patientId !== 'MEDIQ-SYN-HCC-001') return null;
    const [objectId] = matches[0];
    const binding = { subject: principal.subject, patientId: principal.patientId,
      ownershipSubject: 'synthetic-hcc-account', objectId,
      issuer: provider.issuer, audience: provider.apiAudience };
    return Object.freeze({ ...binding,
      revision: createHash('sha256').update(JSON.stringify(binding)).digest('hex') });
  };
}
