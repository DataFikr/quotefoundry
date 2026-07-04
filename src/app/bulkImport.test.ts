// ============================================================================
// bulkImport.test.ts — deterministic CSV/XLSX bulk-import parsing.
// The round-trip tests are the contract: the template we hand the user must
// re-import cleanly without edits.
// ============================================================================
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  customersTemplateCsv, materialsTemplateCsv,
  parseCustomersFile, parseMaterialsFile, mergeMaterials, formatUsPhone,
} from './bulkImport';

const csvBuf = (csv: string) => new TextEncoder().encode(csv);

function xlsxBuf(rows: any[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('customer bulk import', () => {
  it('round-trips its own template', () => {
    const res = parseCustomersFile(csvBuf(customersTemplateCsv()));
    expect(res.error).toBeUndefined();
    expect(res.skipped).toBe(0);
    expect(res.customers).toHaveLength(2);
    expect(res.customers[0]).toMatchObject({
      company_name: 'Apex Steel Erectors',
      email: 'purchasing@apexsteel.com',
      phone: '+1 (713) 555-0142', // normalized on import
      website: 'https://apexsteel.com',
      default_terms: 'Net 30',
    });
    expect(res.customers[1].website).toBeUndefined(); // blank cell -> undefined
  });

  it('matches header synonyms (Company / E-mail / Tel / URL)', () => {
    const res = parseCustomersFile(xlsxBuf([
      ['Company', 'E-mail', 'Tel', 'URL'],
      ['Bayou Weld Co', 'shop@bayouweld.com', '832-555-0101', 'bayouweld.com'],
    ]));
    expect(res.customers).toEqual([{
      company_name: 'Bayou Weld Co', contact_name: undefined,
      email: 'shop@bayouweld.com', phone: '+1 (832) 555-0101',
      website: 'bayouweld.com', default_terms: 'Net 30',
    }]);
  });

  it('skips rows without a company name and counts them', () => {
    const res = parseCustomersFile(xlsxBuf([
      ['Customer Name', 'Email'],
      ['Real Shop', 'a@b.com'],
      ['', 'orphan@b.com'],
    ]));
    expect(res.customers).toHaveLength(1);
    expect(res.skipped).toBe(1);
  });

  it('fails the whole file when no name column exists', () => {
    const res = parseCustomersFile(xlsxBuf([['Foo', 'Bar'], ['x', 'y']]));
    expect(res.error).toBeTruthy();
    expect(res.customers).toHaveLength(0);
  });
});

describe('material bulk import', () => {
  it('round-trips its own template', () => {
    const res = parseMaterialsFile(csvBuf(materialsTemplateCsv()));
    expect(res.error).toBeUndefined();
    expect(res.skipped).toBe(0);
    expect(res.materials).toEqual([
      { name: 'A36 Steel', price: 0.85 },
      { name: 'A500 Tube', price: 0.95 },
      { name: '304 Stainless', price: 2.1 },
    ]);
  });

  it('matches price synonyms and tolerates $ , and /lb noise', () => {
    const res = parseMaterialsFile(xlsxBuf([
      ['Material Name', 'Price per lb'],
      ['Galvanized Sheet', '$1,234.50'],
      ['AR400 Plate', '1.15 /lb'],
    ]));
    expect(res.materials).toEqual([
      { name: 'Galvanized Sheet', price: 1234.5 },
      { name: 'AR400 Plate', price: 1.15 },
    ]);
  });

  it('skips zero/negative/blank prices and blank names', () => {
    const res = parseMaterialsFile(xlsxBuf([
      ['Material', 'Cost per lbs'],
      ['Good Steel', 0.9],
      ['Zero Steel', 0],
      ['', 1.5],
      ['NaN Steel', 'abc'],
    ]));
    expect(res.materials).toEqual([{ name: 'Good Steel', price: 0.9 }]);
    expect(res.skipped).toBe(3);
  });

  it('fails the whole file when the price column is missing', () => {
    const res = parseMaterialsFile(xlsxBuf([['Material'], ['A36']]));
    expect(res.error).toBeTruthy();
  });
});

describe('formatUsPhone', () => {
  it('normalizes 10-digit US numbers to +1 (xxx) xxx-xxxx', () => {
    expect(formatUsPhone('7135550142')).toBe('+1 (713) 555-0142');
    expect(formatUsPhone('(713) 555-0142')).toBe('+1 (713) 555-0142');
    expect(formatUsPhone('1-832-555-0101')).toBe('+1 (832) 555-0101');
  });
  it('formats progressively while typing', () => {
    expect(formatUsPhone('713')).toBe('+1 (713');
    expect(formatUsPhone('713555')).toBe('+1 (713) 555');
    expect(formatUsPhone('7135550')).toBe('+1 (713) 555-0');
  });
  it('leaves empty and non-US input alone', () => {
    expect(formatUsPhone('')).toBe('');
    expect(formatUsPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958'); // 11+ digits, not US
  });
});

describe('mergeMaterials', () => {
  it('updates same-name (case-insensitive) prices and appends new ones', () => {
    const { materials, added, updated } = mergeMaterials(
      [{ name: 'A36 Steel', price: 0.85 }, { name: 'A500 Tube', price: 0.95 }],
      [{ name: 'a36 steel', price: 0.92 }, { name: 'AR400 Plate', price: 1.15 }],
    );
    expect(materials).toEqual([
      { name: 'A36 Steel', price: 0.92 },   // price updated, original casing kept
      { name: 'A500 Tube', price: 0.95 },
      { name: 'AR400 Plate', price: 1.15 }, // appended
    ]);
    expect(added).toBe(1);
    expect(updated).toBe(1);
  });

  it('does not mutate the existing array', () => {
    const existing = [{ name: 'A36 Steel', price: 0.85 }];
    mergeMaterials(existing, [{ name: 'A36 Steel', price: 9 }]);
    expect(existing[0].price).toBe(0.85);
  });
});
