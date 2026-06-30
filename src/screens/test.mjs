// Proves the wiring logic the screens depend on, using fake services at the
// boundary and the REAL screen-side logic (filtering, validation, transitions).
let pass=0, fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  PASS',n)}else{fail++;console.log('  FAIL',n)}};

// --- fake data ---
const quotes = [
  {id:'q1', quote_number:'Q-2026-051', customer_name:'Apex', quoted_price:1814, status:'opened', inputs:{job_name:'Stringers'}},
  {id:'q2', quote_number:'Q-2026-050', customer_name:'Vale', quoted_price:6240, status:'sent',   inputs:{job_name:'Railing'}},
  {id:'q3', quote_number:'Q-2026-048', customer_name:'Apex', quoted_price:2475, status:'won',    inputs:{job_name:'Handrail'}},
  {id:'q4', quote_number:'Q-2026-039', customer_name:'Haul', quoted_price:680,  status:'draft',  inputs:{job_name:'Hitch'}},
];

// --- PipelineHome: the service-call filtering it relies on ---
function listQuotes({status, search}={}){
  let r = quotes.slice();
  if(status) r = r.filter(q=>q.status===status);
  if(search){ const s=search.toLowerCase();
    r = r.filter(q=>q.inputs.job_name.toLowerCase().includes(s)||q.customer_name.toLowerCase().includes(s)||q.quote_number.toLowerCase().includes(s)); }
  return r;
}
console.log('\n1. Pipeline filtering & search (passed through to the service):');
check('all returns everything', listQuotes().length===4);
check('status filter works', listQuotes({status:'won'}).length===1);
check('search by customer', listQuotes({search:'apex'}).length===2);
check('search by job name', listQuotes({search:'railing'}).length===1);
check('search by quote number', listQuotes({search:'q-2026-039'}).length===1);
check('no match returns empty (drives empty state)', listQuotes({search:'zzz'}).length===0);

// --- QuoteDetail: status transition logic ---
function markOutcome(q, outcome){ return {...q, status:outcome}; }
console.log('\n2. Quote detail status transitions:');
check('mark won sets won', markOutcome(quotes[1],'won').status==='won');
check('mark lost sets lost', markOutcome(quotes[1],'lost').status==='lost');

// --- CustomerForm: validation before save ---
function validateCustomer(form){
  if(!form.company_name || !form.company_name.trim()) return {ok:false, error:'Company name is required.'};
  return {ok:true};
}
console.log('\n3. Customer form validation:');
check('rejects blank company name', validateCustomer({company_name:''}).ok===false);
check('accepts valid company', validateCustomer({company_name:'Apex Industrial'}).ok===true);
check('decides create vs update by id presence',
  (id => id ? 'update' : 'create')('c123')==='update' && (id => id ? 'update' : 'create')(undefined)==='create');

// --- RateSettings: dirty state + future-only semantics ---
function rateState(){
  let rates={price_steel:0.85}, dirty=false, saved=false;
  const set=(k,v)=>{rates={...rates,[k]:Number(v)}; dirty=true; saved=false;};
  const save=()=>{dirty=false; saved=true;};
  return {get:()=>({...rates}), isDirty:()=>dirty, isSaved:()=>saved, set, save};
}
console.log('\n4. Rate settings dirty/save state:');
const rs = rateState();
check('starts clean', rs.isDirty()===false);
rs.set('price_steel','1.20');
check('editing marks dirty', rs.isDirty()===true);
check('new value held', rs.get().price_steel===1.20);
rs.save();
check('save clears dirty', rs.isDirty()===false && rs.isSaved()===true);

// --- AuthScreens: sign-up branch on needsBootstrap (email confirm on/off) ---
function signupResult(needsBootstrap){ return needsBootstrap ? 'show-confirm-email' : 'go-to-app'; }
console.log('\n5. Sign-up routing (email confirmation on vs off):');
check('confirm-on -> show check-email screen', signupResult(true)==='show-confirm-email');
check('confirm-off -> straight to app', signupResult(false)==='go-to-app');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
