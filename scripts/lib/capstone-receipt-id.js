// Existing makeId encodes two unpadded uint32 hexadecimal values (2..16 chars).
// Receipt shape checks never replace authenticated ownership/binding checks.
export const isConsentReceiptId=value=>typeof value==='string'&&/^consent_[a-f0-9]{2,16}$/.test(value);
export const isTicketReceiptId=value=>typeof value==='string'&&/^ticket_[a-f0-9]{2,16}$/.test(value);
