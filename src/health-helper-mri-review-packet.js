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

const REVIEW_AXES = Object.freeze({
  sourceSupport: {role:'SOURCE_EVIDENCE_REVIEWER', decisions:['UNASSESSED','DIRECT_SUPPORT','PARTIAL_SUPPORT','NO_SUPPORT','AMBIGUOUS']},
  translation: {role:'TRANSLATION_REVIEWER', decisions:['UNASSESSED','FAITHFUL','CORRECTION_REQUIRED','NOT_APPLICABLE']},
  clinical: {role:'CLINICAL_REVIEWER', decisions:['UNASSESSED','ACCEPTABLE_WITHIN_SCOPE','REVISION_REQUIRED','REJECTED']},
  disposition: {role:'CURATION_EDITOR', decisions:['UNASSESSED','RETAIN_DRAFT','REVISE','EXCLUDE']},
});
const RIGHTS_REVIEW = {role:'RIGHTS_REVIEWER',decisions:['UNASSESSED','PUBLIC_DOMAIN_SCOPE_MATCH','PERMISSION_REQUIRED','LINK_ONLY','HOLD']};
const RIGHTS_REVIEW_CONTEXT='기존 권리 범위 메모는 /lab-tests/ 후보 페이지를 대상으로 하므로 이 /mriscans.html Health Topic 요약에 대한 제품 내 저장·번역·표시 권한을 확정하지 않는다. 이 URL 및 hearing aids 연결 링크의 경계를 별도 검토할 것.';

function reject(){throw new Error('HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID');}
function validIsoDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function validateReviewEntry(entry,rule){
  if(!entry||!rule.decisions.includes(entry.decision))reject();
  if(entry.decision==='UNASSESSED'){
    if(entry.reviewerId!==null||entry.reviewerRole!==null||entry.reviewedAt!==null||entry.rationale!==null)reject();
    return;
  }
  if(typeof entry.reviewerId!=='string'||!/^[A-Za-z0-9._:-]{1,64}$/u.test(entry.reviewerId)
    ||entry.reviewerRole!==rule.role||!validIsoDate(entry.reviewedAt)
    ||typeof entry.rationale!=='string'||!entry.rationale.trim()||entry.rationale.length>1000)reject();
}
function validateClaimReview(review,allowedSegmentIds){
  if(!review||Object.keys(review).length!==Object.keys(REVIEW_AXES).length)reject();
  for(const [axis,rule] of Object.entries(REVIEW_AXES))validateReviewEntry(review[axis],rule);
  const support=review.sourceSupport;
  if(!Array.isArray(support.assessedSegmentIds)
    ||new Set(support.assessedSegmentIds).size!==support.assessedSegmentIds.length
    ||support.assessedSegmentIds.some(id=>!allowedSegmentIds.includes(id))
    ||(support.decision==='UNASSESSED'&&support.assessedSegmentIds.length!==0)
    ||(support.decision!=='UNASSESSED'&&support.assessedSegmentIds.length===0))reject();
}
function validateSourceRights(review){
  if(!review||Object.keys(review).length!==5)reject();
  validateReviewEntry(review,RIGHTS_REVIEW);
}
function reviewProgress(packet){
  const claimAxes=Object.keys(REVIEW_AXES);
  const cells=[...packet.claims.flatMap(claim=>claimAxes.map(axis=>claim.review[axis])),packet.source.rightsReview];
  const axisCounts=Object.fromEntries(claimAxes.map(axis=>[axis,
    Object.fromEntries(REVIEW_AXES[axis].decisions.map(decision=>[decision,packet.claims.filter(claim=>claim.review[axis].decision===decision).length]))]));
  const fullyAnnotated=packet.claims.filter(claim=>claimAxes.every(axis=>claim.review[axis].decision!=='UNASSESSED')).length;
  const unassessed=packet.claims.filter(claim=>claimAxes.every(axis=>claim.review[axis].decision==='UNASSESSED')).length;
  const reviewed=cells.filter(cell=>cell.decision!=='UNASSESSED').length;
  return {
    schemaVersion:'health-helper-mri-review-progress/1',status:'REVIEW_PROGRESS_ONLY_NOT_SERVICE_APPROVED',
    packetStatus:packet.status,claims:{total:packet.claims.length,fullyAnnotated,partiallyAnnotated:packet.claims.length-fullyAnnotated-unassessed,unassessed,decisionsByAxis:axisCounts},
    rights:{decision:packet.source.rightsReview.decision,reviewed:packet.source.rightsReview.decision!=='UNASSESSED'},
    reviewCells:{reviewed,total:cells.length,pending:cells.length-reviewed},serviceEligible:false,clinicalUse:false,
    note:'Counts structurally valid review annotations only. Reviewer identity and qualifications are not authenticated; this report does not assess evidence, grant content rights, approve clinical use, or authorize patient-service deployment.',
  };
}

export function composeHealthHelperMriReviewPacket(basePacket,overlay,basePacketSha256){
  if(basePacket?.schemaVersion!=='health-helper-mri-list-review-packet/1'
    ||overlay?.schemaVersion!=='health-helper-mri-review-overlay/1'
    ||overlay.artifactId!=='health-helper-mri-list-review-overlay-2026-10-13-v2'
    ||overlay.status!=='REVIEW_ONLY_NOT_SERVICE_APPROVED'
    ||overlay.basePacket?.file!=='health-helper-mri-list-review-packet-2026-10-13-v1.json'
    ||overlay.basePacket?.sha256!==basePacketSha256
    ||!/^sha256:[a-f0-9]{64}$/u.test(basePacketSha256??'')
    ||overlay.scope?.candidateOnly!==true||overlay.scope?.clinicalUse!==false
    ||overlay.scope?.serviceEligible!==false||overlay.scope?.patientEndpointEnabled!==false
    ||overlay.scope?.modelFineTuningPerformed!==false
    ||overlay.rightsReviewContext!==RIGHTS_REVIEW_CONTEXT
    ||!Array.isArray(overlay.claimReviews)||overlay.claimReviews.length!==Object.keys(EXPECTED_CLAIMS).length)reject();
  const reviewByClaimId=new Map();
  for(const record of overlay.claimReviews){
    if(!EXPECTED_CLAIMS[record?.claimId]||reviewByClaimId.has(record.claimId))reject();
    reviewByClaimId.set(record.claimId,record.review);
  }
  if(reviewByClaimId.size!==basePacket.claims?.length
    ||basePacket.claims.some(claim=>!reviewByClaimId.has(claim.claimId)))reject();
  return {
    ...structuredClone(basePacket),
    source:{...structuredClone(basePacket.source),rightsReviewContext:overlay.rightsReviewContext,rightsReview:structuredClone(overlay.rightsReview)},
    claims:basePacket.claims.map(claim=>({...structuredClone(claim),review:structuredClone(reviewByClaimId.get(claim.claimId))})),
  };
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
    ||packet.source?.rightsReviewContext!==RIGHTS_REVIEW_CONTEXT
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
    validateClaimReview(claim.review,refs);
  }
  validateSourceRights(packet.source.rightsReview);
  return {valid:true,claimCount:packet.claims.length,segmentCount:packet.sourceSegments.length,
    status:packet.status,rightsDecision:packet.source.rightsReview.decision};
}

export function buildHealthHelperMriReviewProgress(packet,corpus,manifest){
  validateHealthHelperMriReviewPacket(packet,corpus,manifest);
  return reviewProgress(packet);
}
