// Test Tier 2: text-layer gate + keyword extraction over realistic RFQ text.
// Pure logic test — same approach as the rest of the build (no real PDF needed;
// the I/O extraction is isolated, the parsing is what we verify).

function pdfTextLayerGate(t){
  const c=(t||'').replace(/\s+/g,' ').trim();
  const words=c?c.split(' ').length:0;
  return (c.length>=40&&words>=8)?{tier:'tier2_text_pdf'}:{tier:'tier3_store_only'};
}
const trim=(v)=>v.replace(/\s+/g,' ').trim();
const RULES=[
  {field:'quantity',confidence:'medium',patterns:[/(?:qty|quantity|order\s*qty|pieces|pcs)\s*[:#]?\s*(\d{1,6})/i],clean:(v)=>v.replace(/[^\d]/g,'')},
  {field:'part_number',confidence:'medium',patterns:[/(?:part\s*(?:number|no|#)|p\/n|\bpn\b)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{0,30}[A-Za-z0-9])/i]},
  {field:'drawing_number',confidence:'medium',patterns:[/(?:drawing\s*(?:number|no|#)|dwg\s*(?:no|#)?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{1,30})/i]},
  {field:'customer_po',confidence:'medium',patterns:[/(?:p\.?o\.?\s*(?:number|no|#)?|purchase\s*order)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{1,30})/i]},
  {field:'material',confidence:'medium',patterns:[/(?:material|matl|mat'?l)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9 \-_.\/]{1,40}?)(?:\s{2,}|\n|$|thickness|qty|finish)/i],clean:trim},
  {field:'thickness',confidence:'medium',patterns:[/(?:thickness|thk|gauge|ga)\s*[:#]?\s*([0-9][0-9.\/" ]{0,12}(?:in|mm|"|ga)?)/i],clean:trim},
  {field:'finish',confidence:'medium',patterns:[/(?:finish|coating)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9 \-_.\/]{1,30}?)(?:\s{2,}|\n|$|qty|material)/i],clean:trim},
  {field:'due_date',confidence:'low',patterns:[/(?:due\s*date|due|need\s*by|required\s*(?:date|by)|delivery\s*date)\s*[:#]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s*\d{0,4})/i],clean:trim},
];
function keywordExtract(text){
  const fields=[],seen=new Set();
  for(const rule of RULES){
    for(const re of rule.patterns){
      const m=text.match(re);
      if(m&&m[1]){
        const value=rule.clean?rule.clean(m[1]):m[1].trim();
        if(value&&!seen.has(rule.field)){fields.push({field:rule.field,value,confidence:rule.confidence});seen.add(rule.field);}
        break;
      }
    }
  }
  return fields;
}
function parsePdfText(text){
  if(pdfTextLayerGate(text).tier==='tier3_store_only') return {tier:'tier3_store_only',gatedOut:true,fields:[]};
  return {tier:'tier2_text_pdf',gatedOut:false,fields:keywordExtract(text)};
}

let pass=0,fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  PASS',n)}else{fail++;console.log('  FAIL',n)}};
const f=(r,name)=>r.fields.find(x=>x.field===name);

console.log('\n1. The gate refuses scanned PDFs BEFORE any parsing (no OCR ever):');
check('empty text -> gated out', parsePdfText('').gatedOut===true);
check('whitespace only -> gated out', parsePdfText('   \n  \n ').gatedOut===true);
check('a few OCR-stray chars -> gated out', parsePdfText('A1 . 3').gatedOut===true);
check('gated-out returns store-only tier', parsePdfText('').tier==='tier3_store_only');

console.log('\n2. A typical text RFQ — labeled fields extracted:');
const rfq = `ACME STEEL FABRICATION
Request for Quote

Part Number: SS-4471-A
Drawing No: D-10293
PO Number: PO-88231
Quantity: 24
Material: A36 Steel
Thickness: 0.25 in
Finish: Powder Coat
Due Date: 07/15/2026

Please quote the above. Thank you.`;
const r = parsePdfText(rfq);
check('passed the gate (real text)', r.gatedOut===false);
check('part number extracted', f(r,'part_number')?.value==='SS-4471-A');
check('drawing number extracted', f(r,'drawing_number')?.value==='D-10293');
check('PO extracted', f(r,'customer_po')?.value==='PO-88231');
check('quantity extracted as digits', f(r,'quantity')?.value==='24');
check('material extracted', f(r,'material')?.value==='A36 Steel');
check('thickness extracted', f(r,'thickness')?.value.includes('0.25'));
check('finish extracted', f(r,'finish')?.value==='Powder Coat');
check('due date extracted', f(r,'due_date')?.value==='07/15/2026');

console.log('\n3. PDF fields are NEVER high-confidence (estimator must verify):');
check('all extracted fields are medium or low', r.fields.every(x=>x.confidence==='medium'||x.confidence==='low'));
check('due date is low confidence', f(r,'due_date')?.confidence==='low');

console.log('\n4. Looser formatting (no colons, abbreviations) still catches some:');
const loose = `RFQ from a customer. We need Qty 6 of part PN A-99.
Matl 304 SS. Need by 2026-08-01. Thanks`;
const r2 = parsePdfText(loose);
check('quantity from "Qty 6"', f(r2,'quantity')?.value==='6');
check('part from "PN A-99"', f(r2,'part_number')?.value==='A-99');
check('material from "Matl 304 SS"', !!f(r2,'material'));
check('date from "Need by ..."', f(r2,'due_date')?.value==='2026-08-01');

console.log('\n5. Text with no recognizable fields -> parsed but empty (not an error):');
const noFields = parsePdfText('This is a long cover letter with plenty of words but none of the labeled fields we look for in a request.');
check('passed gate but found nothing', noFields.gatedOut===false && noFields.fields.length===0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
