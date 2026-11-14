import type { Food } from './types';
import { kcalFromMacros } from './units';

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Shorten at a word boundary, with an ellipsis, so long product names stay readable. */
export const shortName = (s: string, max = 60) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:-]+$/, '') + '…';
};

export type LookupResult =
  /** Values look right: save and use straight away. */
  | { status: 'found'; food: Omit<Food, 'id'> }
  /** Values were found but something is off: show them for checking before saving. */
  | { status: 'review'; food: Omit<Food, 'id'>; reason: string }
  /** The product exists but has no usable nutrition values. */
  | { status: 'incomplete'; name: string; reason: string }
  | { status: 'missing' };

/** Look a barcode up in Open Food Facts. Only the barcode number leaves the device. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<LookupResult> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=product_name,brands,nutriments,serving_quantity,quantity`;
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
  return interpretProduct(code, data.product);
}

/** Turn an Open Food Facts product into a food, deciding whether it can be trusted as is. */
export function interpretProduct(code: string, p: any): LookupResult {
  const nm = p.nutriments ?? {};
  const name = shortName(decode(String(p.product_name || '')) || `Product ${code}`);
  const brand = decode(String(p.brands || '').split(',')[0]) || undefined;
  const serving = n(p.serving_quantity);
  const servingG = serving && serving > 0 ? serving : undefined;

  // Prefer per-100 g values; fall back to per-serving values converted with the serving weight.
  const pick = (key: string) => {
    const per100 = n(nm[`${key}_100g`]);
    if (per100 != null) return { v: per100, converted: false };
    const perServing = n(nm[`${key}_serving`]);
    if (perServing != null && servingG) return { v: (perServing * 100) / servingG, converted: true };
    return null;
  };
  const prot = pick('proteins');
  const carb = pick('carbohydrates');
  const fat = pick('fat');
  const found = [prot, carb, fat].filter(Boolean).length;
  if (found === 0) {
    const perServingOnly = ['proteins_serving', 'carbohydrates_serving', 'fat_serving'].some((k) => n(nm[k]) != null);
    return {
      status: 'incomplete',
      name,
      reason: perServingOnly
        ? `“${name}” only lists values per serving, and its serving weight is unknown.`
        : `“${name}” is in the database, but without protein, carbs or fat values.`,
    };
  }
  const kcalPick = pick('energy-kcal');
  let kcal = kcalPick?.v ?? null;
  if (kcal == null || kcal === 0) {
    const kj = pick('energy-kj') ?? pick('energy');
    if (kj && kj.v > 0) kcal = kj.v / 4.184;
  }
  const p100 = prot?.v ?? 0;
  const c100 = carb?.v ?? 0;
  const f100 = fat?.v ?? 0;
  const implied = kcalFromMacros(p100, c100, f100);
  const food: Omit<Food, 'id'> = {
    name,
    brand,
    per100: { kcal: Math.max(0, Math.round(kcal && kcal > 0 ? kcal : implied)), p: Math.max(0, p100), c: Math.max(0, c100), f: Math.max(0, f100) },
    servingG,
    source: 'barcode',
    barcode: code,
  };

  // Things a crowd-sourced database gets wrong, each sent to the review form instead of saved blindly.
  const problems: string[] = [];
  if ([p100, c100, f100].some((v) => v < 0 || v > 100) || p100 + c100 + f100 > 100.5) problems.push('its protein, carbs and fat add up to more than 100 g per 100 g');
  if (found < 3) problems.push(`it has no value for ${[!prot && 'protein', !carb && 'carbs', !fat && 'fat'].filter(Boolean).join(' or ')}`);
  if (kcal == null) problems.push('it has no energy value, so it was worked out from the macros');
  else if (kcal > 900) problems.push(`its energy (${Math.round(kcal)} kcal per 100 g) is more than pure fat has, probably kJ entered as kcal`);
  else if (implied > 40 && kcal < implied * 0.6) problems.push(`its energy (${Math.round(kcal)} kcal) is far below what the macros imply (about ${Math.round(implied)})`);
  else if (kcal > 40 && implied < kcal * 0.5 && !/beer|wine|lager|ale|cider|vodka|whisk|rum|gin|liqueur/i.test(name)) {
    problems.push(`its energy (${Math.round(kcal)} kcal) is far above what the macros imply (about ${Math.round(implied)})`);
  }
  if (problems.length) {
    if (kcal != null && kcal > 900) food.per100.kcal = Math.round(kcal / 4.184);
    return { status: 'review', food, reason: `Check these values before saving: ${problems.join('; ')}.` };
  }
  return { status: 'found', food };
}
