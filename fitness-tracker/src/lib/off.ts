import type { Food } from './types';
import { kcalFromMacros } from './units';

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
};

export type LookupResult =
  | { status: 'found'; food: Omit<Food, 'id'> }
  | { status: 'incomplete'; name: string } // product exists but has no usable macros
  | { status: 'missing' };

/** Look a barcode up in Open Food Facts. Only the barcode number leaves the device. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<LookupResult> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=product_name,brands,nutriments,serving_quantity`;
  // Give up after 12 s so a dead connection shows an error instead of spinning forever.
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, 12_000);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (timedOut) throw new Error('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return { status: 'missing' };
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return { status: 'missing' };
  const p = data.product;
  const nm = p.nutriments ?? {};
  const name = (String(p.product_name || '').trim() || `Product ${code}`).slice(0, 60);
  const prot = n(nm.proteins_100g);
  const carb = n(nm.carbohydrates_100g);
  const fat = n(nm.fat_100g);
  if (prot == null && carb == null && fat == null) return { status: 'incomplete', name };
  // The database is crowd-sourced. Values that cannot be true (negative, or more than 100 g per
  // 100 g) are treated as missing, so the user reads them off the package instead.
  const vals = [prot ?? 0, carb ?? 0, fat ?? 0];
  if (vals.some((v) => v < 0 || v > 100) || vals[0] + vals[1] + vals[2] > 100.5) return { status: 'incomplete', name };
  let kcal = n(nm['energy-kcal_100g']);
  if (kcal == null) {
    const kj = n(nm['energy-kj_100g']) ?? n(nm.energy_100g);
    kcal = kj != null ? kj / 4.184 : kcalFromMacros(prot ?? 0, carb ?? 0, fat ?? 0);
  }
  const serving = n(p.serving_quantity);
  return {
    status: 'found',
    food: {
      name,
      brand: String(p.brands || '').split(',')[0].trim() || undefined,
      per100: { kcal: Math.max(0, Math.round(kcal)), p: prot ?? 0, c: carb ?? 0, f: fat ?? 0 },
      servingG: serving && serving > 0 ? serving : undefined,
      source: 'barcode',
      barcode: code,
    },
  };
}
