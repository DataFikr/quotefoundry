// ============================================================================
// bulkImport.ts — CSV/XLSX bulk import for the customer list and the material
// library, plus the downloadable templates users fill in.
// ----------------------------------------------------------------------------
// Same philosophy as Doc Assist Tier 1 (spreadsheetParser.ts): deterministic
// header-synonym matching, zero AI. Rows that don't parse are SKIPPED and
// counted, never guessed. Pure functions (no I/O) so they're Vitest-testable;
// the one DOM helper (downloadCsv) is guarded for non-browser environments.
// ============================================================================

import * as XLSX from 'xlsx';
import type { Customer, Material } from '../data-access-layer/lib/types';

// ---- templates -------------------------------------------------------------
// Header spellings here MUST stay in the synonym lists below so a user can
// download the template, fill it, and re-upload it without edits.

export const CUSTOMERS_TEMPLATE_FILENAME = 'quotefoundry-customers-template.csv';
export const MATERIALS_TEMPLATE_FILENAME = 'quotefoundry-materials-template.csv';

export function customersTemplateCsv(): string {
  return [
    'Customer Name,Email,Phone,Website',
    'Apex Steel Erectors,purchasing@apexsteel.com,(713) 555-0142,https://apexsteel.com',
    'Gulf Coast Fab LLC,rfq@gulfcoastfab.com,(281) 555-0177,',
  ].join('\r\n');
}

export function materialsTemplateCsv(): string {
  return [
    'Material,Cost per lbs',
    'A36 Steel,0.85',
    'A500 Tube,0.95',
    '304 Stainless,2.10',
  ].join('\r\n');
}

// ---- header matching -------------------------------------------------------

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9/ ]/g, '').replace(/\s+/g, ' ').trim();

const CUSTOMER_HEADERS: Record<string, string[]> = {
  company_name: ['customer name', 'company', 'company name', 'customer', 'name', 'business name', 'account name'],
  email:        ['email', 'e mail', 'email address', 'contact email', 'mail'],
  phone:        ['phone', 'phone number', 'tel', 'telephone', 'contact phone', 'phone no'],
  website:      ['website', 'web', 'url', 'site', 'web site', 'homepage', 'www'],
  contact_name: ['contact', 'contact name', 'contact person', 'attn'],
};

const MATERIAL_HEADERS: Record<string, string[]> = {
  name:  ['material', 'material name', 'name', 'material spec', 'alloy', 'stock'],
  price: ['cost per lbs', 'cost per lb', 'price per lb', 'price per lbs', 'cost/lb', 'price/lb', '$/lb', 'cost', 'price', 'unit cost', 'rate'],
};

function mapColumns(headers: string[], synonyms: Record<string, string[]>): Record<string, number> {
  const cols: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    for (const [field, variants] of Object.entries(synonyms)) {
      if (cols[field] !== undefined) continue; // first matching column wins
      if (variants.some((v) => norm(v) === n) || norm(field) === n) { cols[field] = i; return; }
    }
  });
  // fuzzy pass for headers like "Customer / Company Name"
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    for (const [field, variants] of Object.entries(synonyms)) {
      if (cols[field] !== undefined) continue;
      if (variants.some((v) => n.includes(norm(v)))) { cols[field] = i; return; }
    }
  });
  return cols;
}

// Shared sheet → rows helper (same header-row hunt as spreadsheetParser).
function sheetRows(fileBuffer: ArrayBuffer | Uint8Array, synonyms: Record<string, string[]>) {
  const data = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : fileBuffer;
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) return { headers: [] as string[], dataRows: [] as any[][], cols: {} as Record<string, number> };

  let headerIdx = 0, best = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const hits = Object.keys(mapColumns((rows[i] ?? []).map(String), synonyms)).length;
    if (hits > best) { best = hits; headerIdx = i; }
  }
  const headers = (rows[headerIdx] ?? []).map((c) => String(c ?? ''));
  return {
    headers,
    dataRows: rows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== '' && c != null)),
    cols: mapColumns(headers, synonyms),
  };
}

// ---- customers -------------------------------------------------------------

export interface CustomerImportResult {
  customers: Array<Omit<Customer, 'id'>>;
  skipped: number;   // rows without a usable company name
  error?: string;    // file-level failure (no name column at all, empty file)
}

export function parseCustomersFile(fileBuffer: ArrayBuffer | Uint8Array): CustomerImportResult {
  const { dataRows, cols } = sheetRows(fileBuffer, CUSTOMER_HEADERS);
  if (cols.company_name === undefined) {
    return { customers: [], skipped: 0, error: 'No "Customer Name" column found. Download the template for the expected headers.' };
  }
  const customers: Array<Omit<Customer, 'id'>> = [];
  let skipped = 0;
  const cell = (row: any[], i?: number) => (i === undefined ? '' : String(row[i] ?? '').trim());
  for (const row of dataRows) {
    const company_name = cell(row, cols.company_name);
    if (!company_name) { skipped++; continue; }
    customers.push({
      company_name,
      contact_name: cell(row, cols.contact_name) || undefined,
      email: cell(row, cols.email) || undefined,
      phone: formatUsPhone(cell(row, cols.phone)) || undefined,
      website: cell(row, cols.website) || undefined,
      default_terms: 'Net 30',
    });
  }
  return { customers, skipped };
}

// ---- materials -------------------------------------------------------------

export interface MaterialImportResult {
  materials: Material[];
  skipped: number;   // rows without a name or a positive price
  error?: string;
}

export function parseMaterialsFile(fileBuffer: ArrayBuffer | Uint8Array): MaterialImportResult {
  const { dataRows, cols } = sheetRows(fileBuffer, MATERIAL_HEADERS);
  if (cols.name === undefined || cols.price === undefined) {
    return { materials: [], skipped: 0, error: 'Need both a "Material" and a "Cost per lbs" column. Download the template for the expected headers.' };
  }
  const materials: Material[] = [];
  let skipped = 0;
  for (const row of dataRows) {
    const name = String(row[cols.name] ?? '').trim();
    // tolerate "$1.23", "1,234.5", "0.85 /lb"
    const price = Number(String(row[cols.price] ?? '').replace(/[$,]/g, '').replace(/\/.*$/, '').trim());
    if (!name || !(price > 0)) { skipped++; continue; }
    materials.push({ name, price });
  }
  return { materials, skipped };
}

// Merge imported materials into the existing library: same name (case-
// insensitive) updates the price; new names append. Order is preserved.
// A category on the imported entry backfills a missing one (the starter catalog
// categorizes old default entries) but never overwrites a shop-chosen category.
export function mergeMaterials(existing: Material[], imported: Material[]): { materials: Material[]; added: number; updated: number } {
  const materials = existing.map((m) => ({ ...m }));
  let added = 0, updated = 0;
  for (const im of imported) {
    const hit = materials.find((m) => m.name.toLowerCase() === im.name.toLowerCase());
    if (hit) {
      if (hit.price !== im.price) { hit.price = im.price; updated++; }
      if (im.category && !hit.category) hit.category = im.category;
    }
    else { materials.push({ ...im }); added++; }
  }
  return { materials, added, updated };
}

// ---- phone formatting --------------------------------------------------------

// Normalize US phone numbers to "+1 (713) 555-0142" — applied live as the user
// types in the customer form and to bulk-imported rows. Non-US/garbled input
// (too few/many digits) is returned as typed rather than mangled.
export function formatUsPhone(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  let d = trimmed.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length > 10) return trimmed; // not a US 10-digit number — leave it alone
  if (d.length <= 3) return `+1 (${d}`;
  if (d.length <= 6) return `+1 (${d.slice(0, 3)}) ${d.slice(3)}`;
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ---- browser download helper ------------------------------------------------

export function downloadCsv(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
