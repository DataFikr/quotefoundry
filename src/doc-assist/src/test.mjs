import * as XLSX from 'xlsx';

// --- inline the real logic (TS compiled to JS equivalents) for the test ---
const SPREADSHEET_EXT = new Set(['xlsx','xls','csv','tsv']);
const STORE_ONLY_EXT = new Set(['dwg','dxf','step','stp','stl','png','jpg','jpeg','zip','docx']);
const ext = (f) => { const i=f.lastIndexOf('.'); return i>=0?f.slice(i+1).toLowerCase():''; };
function routeByType(filename){
  const e=ext(filename);
  if(SPREADSHEET_EXT.has(e)) return {tier:'tier1_spreadsheet',parseable:true};
  if(e==='pdf') return {tier:'tier2_text_pdf',parseable:true};
  if(STORE_ONLY_EXT.has(e)) return {tier:'tier3_store_only',parseable:false};
  return {tier:'tier3_store_only',parseable:false};
}
function pdfTextLayerGate(t){
  const c=(t||'').replace(/\s+/g,' ').trim();
  const words=c?c.split(' ').length:0;
  return (c.length>=40&&words>=8)?{tier:'tier2_text_pdf',parseable:true}:{tier:'tier3_store_only',parseable:false};
}
const SYNONYMS={
  quantity:['qty','quantity','order qty','qty req','pieces','pcs','count'],
  part_number:['part number','part no','part','pn','item number','item no'],
  description:['description','desc','job name','part name','item','item description'],
  material:['material','matl','material spec','mat','stock'],
  thickness:['thickness','thk','gauge','ga'],
  finish:['finish','coating','surface finish','paint','powder coat'],
  due_date:['due date','due','need by','required date','delivery date'],
  customer_po:['po','po number','po no','purchase order','customer po'],
  notes:['notes','note','comments','remarks','special instructions'],
};
const norm=(s)=>String(s??'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
function matchHeader(header){
  const h=norm(header); if(!h) return null;
  for(const [field,variants] of Object.entries(SYNONYMS)){
    if(norm(field)===h) return {field,confidence:'high'};
    const exactV=variants.find(v=>norm(v)===h);
    if(exactV) return {field,confidence:variants[0]===exactV?'high':'medium'};
  }
  for(const [field,variants] of Object.entries(SYNONYMS)){
    if(variants.some(vv=>h.includes(norm(vv))||norm(vv).includes(h))) return {field,confidence:'medium'};
  }
  return null;
}
function parseSpreadsheet(buf){
  const wb=XLSX.read(buf,{type:'buffer'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,blankrows:false});
  if(!rows.length) return {fields:[],additionalRows:0,unmatchedHeaders:[]};
  let headerIdx=0,best=0;
  for(let i=0;i<Math.min(rows.length,10);i++){
    const m=rows[i].filter(c=>matchHeader(String(c))).length;
    if(m>best){best=m;headerIdx=i;}
  }
  const headers=(rows[headerIdx]||[]).map(c=>String(c??''));
  const dataRows=rows.slice(headerIdx+1).filter(r=>r.some(c=>c!==''&&c!=null));
  const colMap=[],unmatched=[];
  headers.forEach((header,col)=>{
    if(!header.trim()) return;
    const m=matchHeader(header);
    if(m) colMap.push({col,field:m.field,confidence:m.confidence,header});
    else unmatched.push(header);
  });
  const first=dataRows[0]||[];
  const fields=colMap.map(({col,field,confidence,header})=>({field,confidence,sourceHeader:header,value:first[col]??''})).filter(f=>f.value!==''&&f.value!=null);
  return {fields,additionalRows:Math.max(0,dataRows.length-1),unmatchedHeaders:unmatched};
}

// --- build test spreadsheets ---
function makeXlsx(aoa){
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Sheet1');
  return XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
}

let pass=0,fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  PASS',n)}else{fail++;console.log('  FAIL',n)}};

console.log('\n1. Tier router sends each file to the right tier:');
check('xlsx -> tier 1', routeByType('rfq.xlsx').tier==='tier1_spreadsheet');
check('csv -> tier 1', routeByType('parts.csv').tier==='tier1_spreadsheet');
check('pdf -> tier 2 (pending gate)', routeByType('drawing.pdf').tier==='tier2_text_pdf');
check('dwg -> tier 3 store-only', routeByType('part.dwg').tier==='tier3_store_only');
check('stp -> tier 3 store-only', routeByType('model.stp').tier==='tier3_store_only');
check('png -> tier 3 (no OCR)', routeByType('scan.png').tier==='tier3_store_only');
check('unknown ext -> tier 3 (never block)', routeByType('mystery.xyz').tier==='tier3_store_only');

console.log('\n2. Text-layer gate keeps us out of OCR:');
check('rich text PDF -> tier 2', pdfTextLayerGate('Part Number 4471 Quantity 12 Material A36 steel due June').tier==='tier2_text_pdf');
check('empty/scanned PDF -> tier 3 (no OCR)', pdfTextLayerGate('').tier==='tier3_store_only');
check('few stray chars -> tier 3', pdfTextLayerGate('A1 .').tier==='tier3_store_only');

console.log('\n3. Spreadsheet parse — clean headers, exact matches = high confidence:');
const clean = makeXlsx([
  ['Part Number','Quantity','Material','Finish','Due Date'],
  ['SS-4471','12','A36 Steel','Powder Coat','2026-07-15'],
]);
const r1 = parseSpreadsheet(clean);
check('found 5 fields', r1.fields.length===5);
check('quantity value correct', r1.fields.find(f=>f.field==='quantity').value==12);
check('material value correct', r1.fields.find(f=>f.field==='material').value==='A36 Steel');
check('exact header = high confidence', r1.fields.find(f=>f.field==='quantity').confidence==='high');

console.log('\n4. Synonym + abbreviation headers still map (medium confidence):');
const abbrev = makeXlsx([
  ['PN','Qty','Matl','Thk'],
  ['X-9','5','304 SS','0.25'],
]);
const r2 = parseSpreadsheet(abbrev);
check('PN -> part_number', !!r2.fields.find(f=>f.field==='part_number'));
check('Qty -> quantity', !!r2.fields.find(f=>f.field==='quantity'));
check('Matl -> material', !!r2.fields.find(f=>f.field==='material'));
check('Thk -> thickness', !!r2.fields.find(f=>f.field==='thickness'));
check('abbreviation = medium confidence', r2.fields.find(f=>f.field==='material').confidence==='medium');

console.log('\n5. Header row not on row 1 (preamble above) is still found:');
const preamble = makeXlsx([
  ['ACME STEEL CO — Request for Quote',''],
  ['Sent: 2026-06-20',''],
  ['Item Description','Quantity'],
  ['Bracket weldment','40'],
]);
const r3 = parseSpreadsheet(preamble);
check('quantity found despite preamble rows', r3.fields.find(f=>f.field==='quantity')?.value==40);
check('description found', !!r3.fields.find(f=>f.field==='description'));

console.log('\n6. Unmatched headers are reported (to grow the synonym list):');
const weird = makeXlsx([
  ['Quantity','Widget Code','Sparkle Factor'],
  ['3','W-1','high'],
]);
const r4 = parseSpreadsheet(weird);
check('matched quantity', !!r4.fields.find(f=>f.field==='quantity'));
check('reported unmatched headers', r4.unmatchedHeaders.includes('Widget Code') && r4.unmatchedHeaders.includes('Sparkle Factor'));

console.log('\n7. Multi-row sheet: first item applied, rest counted:');
const multi = makeXlsx([
  ['Part','Qty'],
  ['A','1'],['B','2'],['C','3'],
]);
const r5 = parseSpreadsheet(multi);
check('first row pre-filled (Part=A)', r5.fields.find(f=>f.field==='part_number').value==='A');
check('2 additional rows reported', r5.additionalRows===2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
