import { kcalFromMacros } from './units';

export interface LabelValues {
  kcal: number | null;
  p: number | null;
  c: number | null;
  f: number | null;
}

export interface LabelResult {
  /** What the numbers on the label refer to. */
  basis: 'per100' | 'serving';
  servingG: number | null;
  /** Values converted to per 100 g where possible (null = could not read). */
  per100: LabelValues;
  /** How many of the four values were read (0–4). */
  found: number;
  /** Values that looked misread and were corrected so the macros agree with the energy figure. */
  adjusted: ('p' | 'c' | 'f')[];
}

interface Num {
  value: number;
  unit: string;
  raw: string; // the digits exactly as read
}

/** Undo the most common OCR slips inside numbers: "O"/"o" for 0, "l"/"I" for 1, "S" for 5. */
function cleanLine(line: string) {
  return line
    .replace(/(?<=\d)\s?¢\s?g?/g, 'g')
    .replace(/(?<=\d)[Oo](?=[\d.,]|\s?(?:g|mg|kcal|kj)\b)/g, '0')
    .replace(/(?<![A-Za-z])[Oo](?=[.,]\d)/g, '0')
    .replace(/(?<![A-Za-z])[Oo](?=\s?(?:g|mg)\b)/g, '0')
    .replace(/(?<=\d)[lI](?=[\d.,])/g, '1')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s+\.(\d)/g, '$1.$2');
}

function numbers(s: string): Num[] {
  const out: Num[] = [];
  const re = /(<\s*)?(\d+(?:\.\d+)?)\s*(kcal|cal|kj|mg|g|%)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push({ value: Number(m[2]), unit: (m[3] ?? '').toLowerCase(), raw: m[2] });
  }
  return out;
}

const ROWS: { key: keyof LabelValues; match: RegExp; skip?: RegExp }[] = [
  { key: 'kcal', match: /\b(energy|energie|calories|kcal)\b/i },
  { key: 'f', match: /\bfat\b|\bfett\b|\blipid/i, skip: /saturat|trans|mono|poly|of which|calories from/i },
  { key: 'c', match: /carbohydrate|carbs\b|glucides|kohlenhydrate/i, skip: /of which/i },
  { key: 'p', match: /protein|eiwei/i },
];

/**
 * Pull energy, protein, carbohydrate and fat out of OCR text from a nutrition table.
 * Handles EU-style tables ("per 100 g", optionally with a per-serving column) and
 * US-style "Nutrition Facts" panels (per serving, converted using the serving size in grams).
 */
export function parseNutritionText(text: string): LabelResult {
  const lines = text.split(/\r?\n/).map(cleanLine).map((l) => l.trim()).filter(Boolean);
  const all = lines.join('\n');

  const has100 = /\b(?:per|pro|pour|je)?\s*100\s*(?:g|ml)\b/i.test(all);
  const servingMatch =
    /serving size[^\n]*?(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i.exec(all) ??
    /(?:per|pro)\s+(?:serving|portion)[^\n]*?\(?\s*(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i.exec(all) ??
    /(?:serving|portion)\s*\(?\s*(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i.exec(all) ??
    /(?:per|pro)\s+(?!100\s*(?:g|ml))(\d+(?:\.\d+)?)\s*(?:g|ml)\s+(?:serving|portion)/i.exec(all);
  // "(55g)" is often read as "(559)": accept a bracketed number ending in 9 on the serving line.
  const servingAs9 = servingMatch ? null : /serving size[^\n]*?\(\s*(\d+(?:\.\d+)?)9\s*\)/i.exec(all);
  const servingG = servingMatch ? Number(servingMatch[1]) : servingAs9 ? Number(servingAs9[1]) : null;
  const basis: 'per100' | 'serving' = has100 ? 'per100' : 'serving';

  // Which numeric column holds the per-100 g values (when both columns exist)?
  let column = 0;
  if (has100) {
    const header = lines.find((l) => /100\s*(?:g|ml)/i.test(l) && /serving|portion/i.test(l));
    if (header) {
      const i100 = header.search(/100\s*(?:g|ml)/i);
      const iServ = header.search(/serving|portion/i);
      if (iServ >= 0 && iServ < i100) column = 1;
    }
  }

  // First collect the candidate numbers for each row, then decide how to read them.
  const raw: LabelValues = { kcal: null, p: null, c: null, f: null };
  const gramRows: Partial<Record<keyof LabelValues, Num[]>> = {};
  for (const line of lines) {
    for (const row of ROWS) {
      if (raw[row.key] != null || gramRows[row.key]) continue;
      const hit = row.match.exec(line);
      if (!hit || (row.skip && row.skip.test(line))) continue;
      if (/serving size|servings per/i.test(line)) continue;
      const nums = numbers(line.slice(hit.index)).filter((x) => x.unit !== '%' && x.unit !== 'mg');
      if (!nums.length) continue;
      if (row.key === 'kcal') {
        const kcals = nums.filter((x) => x.unit === 'kcal' || x.unit === 'cal');
        const kjs = nums.filter((x) => x.unit === 'kj');
        if (kcals.length) raw.kcal = (kcals[column] ?? kcals[0]).value;
        else if (kjs.length) raw.kcal = Math.round((kjs[column] ?? kjs[0]).value / 4.184);
        else if (/kj/i.test(line) && !/kcal|calories/i.test(line)) raw.kcal = Math.round(nums[0].value / 4.184);
        else raw.kcal = (nums[column] ?? nums[0]).value;
      } else {
        const grams = nums.filter((x) => x.unit === 'g' || x.unit === '');
        if (grams.length) gramRows[row.key] = grams;
      }
    }
  }

  // The classic OCR slip on labels: the unit "g" is read as the digit 9 ("6.5g" -> "6.59", "62g" -> "629").
  // If this label prints units (some value kept its "g"), or every unit-less value ends in 9, then a
  // unit-less value ending in 9 is really "<number>g" and the 9 is dropped.
  const keys = ['p', 'c', 'f'] as const;
  const chosen: Partial<Record<(typeof keys)[number], Num>> = {};
  for (const k of keys) {
    const grams = gramRows[k];
    if (grams) chosen[k] = grams[column] ?? grams[0];
  }
  const picked = keys.map((k) => gramRows[k]).filter(Boolean).flat() as Num[];
  const withUnit = picked.filter((x) => x.unit === 'g').length;
  const bare = picked.filter((x) => x.unit === '');
  const gAs9 = bare.length > 0 && (withUnit > 0 || bare.every((x) => /\d9$/.test(x.raw)));
  const baseline = (x: Num): number => {
    const suspicious = x.unit === '' && /\d9$/.test(x.raw);
    if (suspicious && (gAs9 || (basis === 'per100' && x.value > 100))) return Number(x.raw.slice(0, -1));
    return x.value;
  };
  for (const k of keys) if (chosen[k]) raw[k] = baseline(chosen[k]!);

  // Second line of defence: energy is the value OCR gets right most reliably, and protein, carbs and
  // fat must roughly add up to it (4/4/9 kcal per gram). When they do not, try the two misreadings
  // seen in practice (a stray trailing 9, a lost decimal point) and keep the combination that fits.
  const adjusted: (typeof keys)[number][] = [];
  const limit = basis === 'per100' ? 100.5 : servingG ? servingG + 0.5 : Infinity;
  if (raw.kcal != null && keys.every((k) => chosen[k])) {
    const energy = raw.kcal;
    const err = (p: number, c: number, f: number) => Math.abs(kcalFromMacros(p, c, f) - energy) / Math.max(energy, 20);
    const fits = (p: number, c: number, f: number) => p + c + f <= limit;
    const base = keys.map((k) => raw[k]!) as [number, number, number];
    if (!fits(...base) || err(...base) > 0.15) {
      const options = keys.map((k) => {
        const tok = chosen[k]!;
        const out: { v: number; cost: number }[] = [{ v: raw[k]!, cost: 0 }];
        const add = (v: number, cost: number) => {
          if (Number.isFinite(v) && !out.some((o) => o.v === v)) out.push({ v, cost });
        };
        const noPoint = (r: string) => !r.includes('.') && r.length >= 2;
        add(tok.value, 0.02);
        if (noPoint(tok.raw)) add(tok.value / 10, 0.05);
        if (/\d9$/.test(tok.raw)) {
          const stripped = tok.raw.slice(0, -1);
          add(Number(stripped), 0.02);
          if (noPoint(stripped)) add(Number(stripped) / 10, 0.07);
        }
        return out;
      });
      let best: { vals: [number, number, number]; score: number; e: number } | null = null;
      for (const p of options[0]) for (const c of options[1]) for (const f of options[2]) {
        if (!fits(p.v, c.v, f.v)) continue;
        const e = err(p.v, c.v, f.v);
        // If all three would need changing, the energy figure itself is the likelier misread. Only
        // accept that when the values as read are impossible (more than 100 g per 100 g) and the fit is close.
        const changes = [p.v, c.v, f.v].filter((v, i) => v !== base[i]).length;
        if (changes > 2 && !(e <= 0.1 && !fits(...base))) continue;
        const score = e + p.cost + c.cost + f.cost;
        if (!best || score < best.score) best = { vals: [p.v, c.v, f.v], score, e };
      }
      if (best && best.e <= 0.2) {
        keys.forEach((k, i) => {
          if (best!.vals[i] !== raw[k]) adjusted.push(k);
          raw[k] = best!.vals[i];
        });
      }
    }
  }

  const found = (['kcal', 'p', 'c', 'f'] as const).filter((k) => raw[k] != null).length;
  let per100 = raw;
  if (basis === 'serving' && servingG && servingG > 0) {
    const k = 100 / servingG;
    const r1 = (v: number | null) => (v == null ? null : Math.round(v * k * 10) / 10);
    per100 = { kcal: raw.kcal == null ? null : Math.round(raw.kcal * k), p: r1(raw.p), c: r1(raw.c), f: r1(raw.f) };
  }
  if (per100.kcal == null && per100.p != null && per100.c != null && per100.f != null) {
    per100 = { ...per100, kcal: Math.round(kcalFromMacros(per100.p, per100.c, per100.f)) };
  }
  return { basis, servingG, per100, found, adjusted };
}

/** Shrink big phone photos so OCR is fast, and return a canvas the engine can read. */
async function toCanvas(file: Blob, maxSide = 1800): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvas;
}

/** Read the text in a photo entirely on this device. The photo is never uploaded. */
export async function readLabelText(file: Blob, onProgress?: (fraction: number) => void): Promise<string> {
  const [{ createWorker }, canvas] = await Promise.all([import('tesseract.js'), toCanvas(file)]);
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    // Mode 4 keeps each table row on one line; mode 6 is the fallback when that reads too little.
    await worker.setParameters({ tessedit_pageseg_mode: '4' as any });
    const first = (await worker.recognize(canvas)).data.text;
    if (parseNutritionText(first).found === 4) return first;
    await worker.setParameters({ tessedit_pageseg_mode: '6' as any });
    const second = (await worker.recognize(canvas)).data.text;
    return parseNutritionText(second).found > parseNutritionText(first).found ? second : first;
  } finally {
    await worker.terminate();
  }
}
