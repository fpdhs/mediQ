import {createPatientHelper} from '../ui/patient-helper.js';
import {createHealthRecordClient} from '../ui/health-record-client.js';

// Topic choices are not patient records or medical evidence.
const TOPICS = Object.freeze([
  ['AFP', '혈청 AFP'], ['AST', '간 효소 AST'], ['ALT', '간 효소 ALT'],
  ['GGT', '간 효소 γ-GTP'], ['LIVER', '간기능검사'],
].map(([kind, title]) => Object.freeze({id:`topic-${kind}`, kind, title, date:'검사 주제'})));

export async function askMobileHealthHelper(question, {signal, headers, isUnlocked, request = fetch} = {}) {
  if (!isUnlocked?.()) throw new Error('MOBILE_APP_LOCKED');
  const signedHeaders = headers?.();
  if (!/^Bearer \S+$/u.test(signedHeaders?.authorization ?? '')) throw new Error('CAPSTONE_AUTH_REQUIRED');
  const response = await request('/api/v1/me/health-helper/questions', {
    method:'POST', headers:{'content-type':'application/json', authorization:signedHeaders.authorization},
    body:JSON.stringify({question}), signal, cache:'no-store', redirect:'error',
  });
  const text = await response.text();
  if (text.length > 32768) throw new Error('HELPER_RESPONSE_TOO_LARGE');
  const result = JSON.parse(text);
  if (!response.ok || result.error) throw new Error(result.error || 'HELPER_REQUEST_FAILED');
  if (!isUnlocked?.()) throw new Error('MOBILE_APP_LOCKED');
  return result;
}

export function createMobileHealthHelper(root, {headers, isUnlocked} = {}) {
  let helper;
  const client=createHealthRecordClient({headers,available:isUnlocked,onChange:()=>helper?.refresh()});
  helper=createPatientHelper(root, {
    surface:'mobile', getRecords:() => isUnlocked?.() ? TOPICS : [],
    getComparisons:()=>client.records(),recordStatus:()=>client.status(),retryRecords:()=>client.load(),
    ask:(question, {signal}) => askMobileHealthHelper(question, {signal, headers, isUnlocked}),
  });
  return {refresh(){helper?.refresh();void client.load();},reset(){client.reset();helper?.reset();}};
}
