import {isIP} from 'node:net';
import {resolveSchoolDemoLanPort} from '../src/health-helper-school-demo-runtime-config.js';

const lanHost=process.env.HIPASS_HEALTH_HELPER_SCHOOL_LAN_HOST;
const octets=typeof lanHost==='string'&&isIP(lanHost)===4?lanHost.split('.').map(Number):[];
const isPrivateIpv4=octets.length===4&&(octets[0]===10
 ||octets[0]===172&&octets[1]>=16&&octets[1]<=31
 ||octets[0]===192&&octets[1]===168);
if(!isPrivateIpv4)throw new Error('SCHOOL_LAN_PRIVATE_IPV4_REQUIRED');

const conflictingModes=[
 'HIPASS_HEALTH_EDUCATION','HIPASS_AFP_EVIDENCE','HIPASS_LIVER_EVIDENCE',
 'HIPASS_IMAGING_EVIDENCE','HIPASS_SCENARIO_EVIDENCE',
];
if(conflictingModes.some(name=>process.env[name]==='1'))throw new Error('SCHOOL_DEMO_MODE_CONFLICT');

process.env.HIPASS_HEALTH_HELPER_SCHOOL_DEMO='1';
process.env.HIPASS_MEDLINEPLUS_PREVIEW_PORT=resolveSchoolDemoLanPort(process.env.HIPASS_HEALTH_HELPER_SCHOOL_LAN_PORT);
process.env.HIPASS_MEDLINEPLUS_UPLOADED='1';
process.env.HIPASS_HEALTH_HELPER_SCHOOL_BIND_ADDRESS=lanHost;
process.env.HIPASS_HEALTH_HELPER_SCHOOL_PUBLIC_HOST=lanHost;

await import('./medlineplus-local-preview.js');
