import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,verifyFullScope,sourceBody,splitTranslationSource,translationChecks,translationPayload} from '../src/medlineplus-translation.js';
test('translation source pieces preserve every character and range',()=>{
 const source='A heading\n\n'+('First sentence. Second sentence without loss.\n\n').repeat(80);
 const pieces=splitTranslationSource(source);assert.equal(pieces.map(p=>p.text).join(''),source);
 for(const p of pieces){assert.equal(source.slice(p.start,p.end),p.text);assert.ok(p.text.length<=650);}
});
test('automatic translation checks never become clinical approval; numbers and negation hold',()=>{
 assert.equal(translationChecks('For 3 months','3개월 동안').status,'AUTOMATED_CHECKS_PASS');
 assert.equal(translationChecks('For 3 months','6개월 동안').reason,'NUMERIC_TOKENS_DIFFER');
 assert.equal(translationChecks('It is not a diagnosis','진단입니다').status,'HOLD');
 assert.equal(translationChecks('It is not a diagnosis','진단이 아닙니다').clinicalReview,'UNASSIGNED');
 assert.equal(translationChecks('Do not eat','먹지 말 것을 요청받습니다').status,'AUTOMATED_CHECKS_PASS');
 assert.equal(translationChecks('Read about A1C','당화혈색소').status,'HOLD');
 assert.equal(translationChecks('Safe','<script>bad</script>').status,'HOLD');
 assert.equal(translationChecks('We use contrast material','대비 물질을 사용합니다').reason,'CONTRAST_TERMINOLOGY_REVIEW_REQUIRED');
 assert.equal(translationChecks('We use contrast material','조영제를 사용합니다').status,'AUTOMATED_CHECKS_PASS');
 assert.equal(translationChecks('You may need an enema','클리저가 필요할 수 있습니다').reason,'ENEMA_TERMINOLOGY_REVIEW_REQUIRED');
 assert.equal(translationChecks('You may need an enema','관장이 필요할 수 있습니다').status,'AUTOMATED_CHECKS_PASS');
 assert.equal(translationChecks('above 6.5%','6.5% 이상').reason,'COMPARISON_OPERATOR_CHANGED');
 assert.equal(translationChecks('above 6.5%','6.5% 초과').status,'AUTOMATED_CHECKS_PASS');
 const payload=translationPayload({text:'Source only'});assert.equal(payload.model,'qwen3.5:4b');assert.equal(payload.stream,false);
});
test('full scope verifies bytes, counts, language, excluded content, official URL and supplement hashes',()=>{
 const doc={source_topic_id:'1',language:'English',source_url:'https://medlineplus.gov/anemia.html',
 rights_policy_url:'https://medlineplus.gov/about/using/usingcontent/',external_link_bodies_retrieved:false,summary_images_retrieved:false,
 effective_source_body_location:'source_text_en',source_text_en:'Fixture text',translation_status:'PENDING'};
 const build=d=>{const bytes=Buffer.from(JSON.stringify([d][0])+'\n');return {bytes,manifest:{output:{bytes:bytes.length,sha256:digest(bytes)},counts:{output_jsonl_records:1,not_previously_translated_topics:1}}};};
 const good=build(doc);assert.equal(verifyFullScope(good.bytes,good.manifest).length,1);
 assert.throws(()=>verifyFullScope(Buffer.from('tampered'),good.manifest));
 for(const d of [{...doc,source_url:'https://evil.example/anemia.html'},{...doc,external_link_bodies_retrieved:true},{...doc,language:'Spanish'}]){
 const v=build(d);assert.throws(()=>verifyFullScope(v.bytes,v.manifest));}
 const supplement={...doc,effective_source_body_location:'supplementary_sources[0].source_text_en',source_text_en:null,
 supplementary_sources:[{source_url:doc.source_url,source_text_en:'Supplement',source_text_sha256:digest('Supplement'),source_summary_html:'<p>Supplement</p>',source_html_sha256:digest('<p>Supplement</p>')}]};
 const v=build(supplement);assert.equal(sourceBody(verifyFullScope(v.bytes,v.manifest)[0]),'Supplement');
 supplement.supplementary_sources[0].source_text_sha256='bad';const bad=build(supplement);assert.throws(()=>verifyFullScope(bad.bytes,bad.manifest));
});
