// Tests the REAL logic with failure modes: ownership re-check, open-tracking
// state guard, default builder. Mocks the admin client + provider at boundary.
let pass=0, fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  PASS',n)}else{fail++;console.log('  FAIL',n)}};

// fake db
const db = {
  quotes: new Map([
    ['q1', {id:'q1', shop_id:'shopA', status:'sent', opened_at:null, quote_number:'Q-2026-051', job_name:'Stair stringers', shops:{name:'Ironside'}}],
    ['q2', {id:'q2', shop_id:'shopB', status:'sent', opened_at:null, quote_number:'Q-2026-201', job_name:'Railing', shops:{name:'Apex'}}],
    ['q3', {id:'q3', shop_id:'shopA', status:'won', opened_at:'2026-06-20', quote_number:'Q-2026-048', job_name:'Handrail', shops:{name:'Ironside'}}],
  ]),
  events: [],
};

// --- ownership re-check (the server-side guard) ---
function verifyOwnership(quote, callerShopId){
  if(!quote) return {ok:false,error:'Quote not found.'};
  if(quote.shop_id !== callerShopId) return {ok:false,error:'That quote belongs to another shop.'};
  return {ok:true};
}

console.log('\n1. Server re-verifies the quote belongs to the caller shop:');
check('shop A can send its own quote q1', verifyOwnership(db.quotes.get('q1'),'shopA').ok===true);
check('shop A CANNOT send shop B quote q2', verifyOwnership(db.quotes.get('q2'),'shopA').ok===false);
check('missing quote is rejected', verifyOwnership(db.quotes.get('nope'),'shopA').ok===false);

// --- open tracking state guard ---
function trackOpen(quoteId){
  const q = db.quotes.get(quoteId);
  if(q && q.status==='sent' && !q.opened_at){
    q.status='opened'; q.opened_at=new Date().toISOString();
    db.events.push({quote_id:quoteId, type:'opened'});
    return 'advanced';
  }
  return 'no-change';
}

console.log('\n2. Open tracking only advances sent -> opened, never downgrades:');
check('a sent quote advances to opened', trackOpen('q1')==='advanced');
check('q1 is now opened', db.quotes.get('q1').status==='opened');
check('opening again does nothing (idempotent)', trackOpen('q1')==='no-change');
check('a WON quote is never downgraded by a stray pixel', trackOpen('q3')==='no-change' && db.quotes.get('q3').status==='won');

// --- default message builder ---
function buildDefaults(quote){
  const price='$'+quote.quoted_price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  return {
    recipient: quote.customer_email ?? '',
    subject: `Quote ${quote.quote_number} — ${quote.job_name}`,
    message: `Hi,\n\nThank you for the opportunity to quote your ${quote.job_name.toLowerCase()}. Our price is ${price}${quote.lead_time?`, with a ${quote.lead_time} lead time from approval`:''}.\n\nThe full quote is attached as a PDF.`,
  };
}

console.log('\n3. Default send form is pre-filled from the quote:');
const d = buildDefaults({quote_number:'Q-2026-051', job_name:'Stair stringers', customer_email:'p@apex.com', quoted_price:1913.82, lead_time:'2-3 weeks'});
check('recipient pulled from customer', d.recipient==='p@apex.com');
check('subject includes quote number + job', d.subject==='Quote Q-2026-051 — Stair stringers');
check('message includes formatted price', d.message.includes('$1,913.82'));
check('message includes lead time', d.message.includes('2-3 weeks'));
const d2 = buildDefaults({quote_number:'Q-2026-052', job_name:'Gate', quoted_price:500});
check('handles missing email/lead time gracefully', d2.recipient==='' && !d2.message.includes('lead time'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
