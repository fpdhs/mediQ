import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildHealthHelperMriReviewProgress,composeHealthHelperMriReviewPacket} from '../src/health-helper-mri-review-packet.js';

const readBytes=path=>readFile(new URL(path,import.meta.url));
const readJson=async path=>JSON.parse((await readBytes(path)).toString('utf8'));

export async function loadHealthHelperMriReviewProgress(){
  const [basePacketBytes,overlay,corpus,manifest]=await Promise.all([
    readBytes('../docs/implementation/health-helper-mri-list-review-packet-2026-10-13-v1.json'),
    readJson('../docs/implementation/health-helper-mri-list-review-overlay-2026-10-13-v2.json'),
    readJson('../data/medlineplus-upload-ko-20261012-v3/corpus.json'),
    readJson('../data/medlineplus-upload-ko-20261012-v3/manifest.json'),
  ]);
  const basePacket=JSON.parse(basePacketBytes.toString('utf8'));
  const basePacketSha256=`sha256:${createHash('sha256').update(basePacketBytes).digest('hex')}`;
  const packet=composeHealthHelperMriReviewPacket(basePacket,overlay,basePacketSha256);
  return buildHealthHelperMriReviewProgress(packet,corpus,manifest);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.stdout.write(`${JSON.stringify(await loadHealthHelperMriReviewProgress(),null,2)}\n`);
}
