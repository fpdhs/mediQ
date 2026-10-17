import test from 'node:test';
import assert from 'node:assert/strict';
import {makeId} from '../src/domain.js';
import {isConsentReceiptId,isTicketReceiptId} from '../scripts/lib/capstone-receipt-id.js';
test('receipt format matches existing unpadded ID contract, not assumed fixed length',()=>{
  for(const suffix of ['00','01','3deb3c9aef19466','91dda11c36e4dd8c']){
    assert.ok(isConsentReceiptId('consent_'+suffix));assert.ok(isTicketReceiptId('ticket_'+suffix));
  }
  for(let n=0;n<100;n++){assert.ok(isConsentReceiptId(makeId('consent')));assert.ok(isTicketReceiptId(makeId('ticket')));}
  for(const value of [undefined,null,'','consent_0','consent_'+'a'.repeat(17),'consent_AB','consent_ab/other','ticket_ab','consent_ab\n'])assert.equal(isConsentReceiptId(value),false);
});
