const EXPECTED_SEGMENTS = Object.freeze({
  '3953-S0010': {chunkId:'upload-3953-3953-S0010-0', text:'MRI 검사는 어떻게 준비하나요?', hash:'sha256:f7b03a95907fa16743c4fa8a77c8d9cd8a66179f2e690286806fb9ac1d9431a7', sourceText:'How do you prepare for an MRI scan?', tag:'h3', xpath:'/div/h3[3]', blockId:'3953-B0012'},
  '3953-S0011': {chunkId:'upload-3953-3953-S0011-0', text:'MRI 장비는 강력한 자석을 사용합니다. 금속 물체나 삽입물은 검사를 방해할 수 있으며 안전하지 않을 수 있습니다.', hash:'sha256:917a81d52323ca3d0858820c08b527108ea6287e0b77b1bc3d23ac02088d1dc1', sourceText:'MRI machines use powerful magnets. Metal objects or implants can interfere with the scan and may be unsafe.', tag:'p', xpath:'/div/p[5]', blockId:'3953-B0013'},
  '3953-S0012': {chunkId:'upload-3953-3953-S0012-0', text:'MRI 전에는 다음과 같은 물품을 제거해야 합니다.', hash:'sha256:6cd866ff9e8406745e3620c7a18d2ff26bd04326590eed9d4d32df2f0e8e1c38', sourceText:'Before your MRI, you will need to remove items such as:', tag:'p', xpath:'/div/p[6]', blockId:'3953-B0014'},
  '3953-S0013': {chunkId:'upload-3953-3953-S0013-0', text:'장신구와 시계', hash:'sha256:d16add6657b3735d200bb8db1d2301f9512ca75c596f3e8a2ff3bca3488af00c', sourceText:'Jewelry and watches', tag:'li', xpath:'/div/ul[2]/li[1]', blockId:'3953-B0016'},
  '3953-S0014': {chunkId:'upload-3953-3953-S0014-0', text:'머리핀', hash:'sha256:d36f54d3d4ef474fb7ae610d2a9a515955ba5448f1a9dc1c5f5c3e290c585e06', sourceText:'Hairpins', tag:'li', xpath:'/div/ul[2]/li[2]', blockId:'3953-B0017'},
  '3953-S0015': {chunkId:'upload-3953-3953-S0015-0', text:'보청기', hash:'sha256:7af0bae6ff5f689babff10ce137c4742b7f56e6ccff590e99a4b53e11937b9f0', sourceText:'Hearing aids', tag:'li', xpath:'/div/ul[2]/li[3]', blockId:'3953-B0018'},
  '3953-S0016': {chunkId:'upload-3953-3953-S0016-0', text:'MRI 전에 다음에 해당하면 의료진에게 알리세요.', hash:'sha256:ca4b46c3441034d0a481f397f3b14eb64f441fc66584c5dea56818d93b6c56a1', sourceText:'Before your MRI, tell your health care provider if you:', tag:'p', xpath:'/div/p[7]', blockId:'3953-B0019'},
  '3953-S0022': {chunkId:'upload-3953-3953-S0022-0', text:'심박조율기, 인공관절 또는 다른 삽입물처럼 금속이나 전자장치가 몸속에 있는 경우', hash:'sha256:cb0a03c39c416791b501507a0dfa5cb557abbeb22e98eb1f15767c2f9170222e', sourceText:'Have metal or electronic devices in your body, such as a pacemaker, artificial joint, or other implants', tag:'li', xpath:'/div/ul[3]/li[6]', blockId:'3953-B0026'},
});

const EXPECTED_CLAIMS = Object.freeze({
  'MRI-PREP-JEWELRY-001': {question:'MRI 전에 장신구를 제거해야 하나요?',focus:'MRI_JEWELRY_REMOVAL',segments:['3953-S0012','3953-S0013']},
  'MRI-PREP-HAIRPIN-001': {question:'MRI 전에 머리핀을 빼야 하나요?',focus:'MRI_JEWELRY_REMOVAL',segments:['3953-S0012','3953-S0014']},
  'MRI-PREP-HEARING-AID-001': {question:'MRI 전에 보청기를 빼야 하나요?',focus:'MRI_JEWELRY_REMOVAL',segments:['3953-S0012','3953-S0015']},
  'MRI-PREP-DEVICE-DISCLOSURE-001': {question:'MRI 전에 심박조율기가 있으면 의료진에게 알려야 하나요?',focus:'MRI_DEVICE_DISCLOSURE',segments:['3953-S0016','3953-S0022']},
});

function reject(){throw new Error('HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID');}
function allUnassessed(review){
  for(const axis of ['sourceSupport','translation','clinical','disposition']){
    const value=review?.[axis];
    if(value?.decision!=='UNASSESSED'||value.reviewerId!==null||value.reviewerRole!==null
      ||value.reviewedAt!==null||value.rationale!==null)reject();
    if(axis==='sourceSupport'&&(!Array.isArray(value.assessedSegmentIds)||value.assessedSegmentIds.length))reject();
  }
}

export function validateHealthHelperMriReviewPacket(packet,corpus,manifest){
  if(packet?.schemaVersion!=='health-helper-mri-list-review-packet/1'
    ||packet.status!=='REVIEW_ONLY_NOT_SERVICE_APPROVED'
    ||packet.scope?.candidateOnly!==true||packet.scope?.clinicalUse!==false
    ||packet.scope?.serviceEligible!==false||packet.scope?.patientEndpointEnabled!==false
    ||packet.scope?.modelFineTuningPerformed!==false)reject();
  if(manifest?.version!=='medlineplus-upload-ko-20261012-v3'
    ||manifest.status!=='DRAFT / UNASSIGNED'||manifest.clinicalUse!==false
    ||manifest.serviceDeployment!==false||packet.candidateCorpus?.version!==manifest.version
    ||packet.candidateCorpus?.inputSha256!==manifest.inputSha256
    ||packet.candidateCorpus?.corpusSha256!==manifest.corpusSha256
    ||packet.candidateInput?.fileSha256!==manifest.inputSha256)reject();
  if(packet.source?.url!=='https://medlineplus.gov/mriscans.html'
    ||packet.source?.localHtmlSnapshot!=='NOT_STORED'
    ||packet.source?.rightsReview?.decision!=='UNASSESSED'
    ||packet.candidateInput?.recordId!=='medlineplus-health-topics-en-3953'
    ||packet.candidateInput?.recordSourceContentSha256!=='sha256:8b363d26a9359ecd7e68e9a89749192ba1215de2625f449480bb6e3128f5a454')reject();

  const chunkById=new Map((corpus?.chunks??[]).map(chunk=>[chunk.chunk_id,chunk]));
  if(corpus?.version!==manifest.version||!Array.isArray(packet.sourceSegments)
    ||packet.sourceSegments.length!==Object.keys(EXPECTED_SEGMENTS).length)reject();
  const segmentById=new Map();
  for(const segment of packet.sourceSegments){
    const expected=EXPECTED_SEGMENTS[segment.sourceSegmentId],chunk=chunkById.get(segment.corpusChunkId);
    if(!expected||segmentById.has(segment.sourceSegmentId)||segment.corpusChunkId!==expected.chunkId
      ||segment.translationSha256!==expected.hash||segment.translationKorean!==expected.text
      ||segment.sourceTextEnglish!==expected.sourceText||segment.sourceHtmlTag!==expected.tag
      ||segment.sourceXPath!==expected.xpath||segment.sourceBlockId!==expected.blockId
      ||!chunk||chunk.doc_id!=='medlineplus-health-topics-en-3953'
      ||!chunk.source_segment_ids?.includes(segment.sourceSegmentId)||chunk.text_ko!==expected.text
      ||chunk.textSha256!==expected.hash||chunk.source_hash!==packet.candidateInput.recordSourceContentSha256
      ||chunk.ai_qa_status!=='PASS'||chunk.contentReview!=='UNASSIGNED'||chunk.clinicalUse!==false)reject();
    segmentById.set(segment.sourceSegmentId,segment);
  }
  if(!Array.isArray(packet.claims)||packet.claims.length!==Object.keys(EXPECTED_CLAIMS).length)reject();
  const seen=new Set();
  for(const claim of packet.claims){
    const expected=EXPECTED_CLAIMS[claim.claimId],refs=expected?.segments;
    if(!expected||seen.has(claim.claimId)||JSON.stringify(claim.sourceSegmentIds)!==JSON.stringify(refs)
      ||claim.question!==expected.question||claim.focus!==expected.focus||claim.intent!=='PREPARE'
      ||refs.some(id=>!segmentById.has(id)))reject();
    const heading=segmentById.get(refs[0]).translationKorean;
    const items=refs.slice(1).map(id=>segmentById.get(id).translationKorean);
    if(claim.candidateDisplay?.kind!=='LIST_GUIDANCE'||claim.candidateDisplay.heading!==heading
      ||JSON.stringify(claim.candidateDisplay.items)!==JSON.stringify(items))reject();
    seen.add(claim.claimId);
    allUnassessed(claim.review);
  }
  return {valid:true,claimCount:packet.claims.length,segmentCount:packet.sourceSegments.length,
    status:packet.status,rightsDecision:packet.source.rightsReview.decision};
}
