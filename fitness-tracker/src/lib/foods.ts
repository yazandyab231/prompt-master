import type { Food } from './types';

// Typical values per 100 g, rounded. Good enough for everyday logging; a packaged
// product's own label (barcode or label scan) will always be more exact.
// [name, kcal, protein, carbs, fat, typical serving in g (optional)]
type Row = [string, number, number, number, number, number?];

const ROWS: Row[] = [
  // Grains & starches
  ['Rice, white, cooked', 130, 2.7, 28.2, 0.3, 150],
  ['Rice, white, raw', 365, 7.1, 80, 0.7, 75],
  ['Rice, brown, cooked', 123, 2.7, 25.6, 1, 150],
  ['Rice, basmati, cooked', 121, 3.5, 25.2, 0.4, 150],
  ['Pasta, cooked', 158, 5.8, 30.9, 0.9, 180],
  ['Pasta, dry', 371, 13, 74.7, 1.5, 80],
  ['Oats, rolled, dry', 379, 13.2, 67.7, 6.5, 50],
  ['Bread, white', 266, 8.9, 49.4, 3.3, 35],
  ['Bread, wholemeal', 247, 13, 41.3, 3.4, 40],
  ['Pita bread', 275, 9.1, 55.7, 1.2, 60],
  ['Tortilla, flour', 306, 8.2, 50.6, 7.6, 45],
  ['Bagel', 257, 10, 50.9, 1.5, 100],
  ['Potato, boiled', 87, 1.9, 20.1, 0.1, 200],
  ['Potato, baked', 93, 2.5, 21.2, 0.1, 200],
  ['Sweet potato, baked', 90, 2, 20.7, 0.2, 180],
  ['Quinoa, cooked', 120, 4.4, 21.3, 1.9, 150],
  ['Couscous, cooked', 112, 3.8, 23.2, 0.2, 150],
  ['Bulgur, cooked', 83, 3.1, 18.6, 0.2, 150],
  ['Cornflakes', 357, 7.5, 84, 0.4, 30],
  ['Granola', 471, 10, 64, 20, 50],
  // Meat & fish
  ['Chicken breast, cooked', 165, 31, 0, 3.6, 150],
  ['Chicken breast, raw', 120, 22.5, 0, 2.6, 150],
  ['Chicken thigh, cooked', 209, 26, 0, 10.9, 120],
  ['Turkey breast, cooked', 135, 30, 0, 0.7, 120],
  ['Beef mince, 5% fat, cooked', 174, 26, 0, 7, 125],
  ['Beef mince, 15% fat, cooked', 250, 26, 0, 15, 125],
  ['Beef steak, sirloin, cooked', 206, 30, 0, 9, 180],
  ['Lamb, cooked', 258, 25.5, 0, 16.5, 120],
  ['Salmon, cooked', 206, 22, 0, 12.4, 140],
  ['Tuna, canned in water', 116, 25.5, 0, 0.8, 100],
  ['Cod, cooked', 105, 23, 0, 0.9, 140],
  ['Shrimp, cooked', 99, 24, 0.2, 0.3, 100],
  ['Sardines, canned', 208, 24.6, 0, 11.5, 90],
  // Eggs & dairy
  ['Egg, whole', 143, 12.6, 0.7, 9.5, 50],
  ['Egg white', 52, 10.9, 0.7, 0.2, 33],
  ['Milk, whole', 61, 3.2, 4.8, 3.3, 250],
  ['Milk, semi-skimmed', 47, 3.4, 4.8, 1.7, 250],
  ['Milk, skimmed', 35, 3.4, 5, 0.1, 250],
  ['Greek yogurt, 0% fat', 59, 10.3, 3.6, 0.4, 170],
  ['Greek yogurt, full fat', 97, 9, 3.9, 5, 170],
  ['Yogurt, plain', 61, 3.5, 4.7, 3.3, 150],
  ['Cottage cheese', 98, 11.1, 3.4, 4.3, 150],
  ['Labneh', 160, 8, 5, 12, 50],
  ['Cheddar cheese', 403, 25, 1.3, 33, 30],
  ['Mozzarella', 280, 28, 3.1, 17, 30],
  ['Feta cheese', 264, 14.2, 4.1, 21.3, 30],
  ['Halloumi', 321, 21, 2.6, 25, 50],
  ['Butter', 717, 0.9, 0.1, 81, 10],
  ['Whey protein powder', 400, 80, 8, 6, 30],
  // Legumes, nuts & seeds
  ['Lentils, cooked', 116, 9, 20.1, 0.4, 150],
  ['Chickpeas, cooked', 164, 8.9, 27.4, 2.6, 150],
  ['Black beans, cooked', 132, 8.9, 23.7, 0.5, 150],
  ['Kidney beans, cooked', 127, 8.7, 22.8, 0.5, 150],
  ['Hummus', 166, 7.9, 14.3, 9.6, 50],
  ['Tofu, firm', 144, 15.8, 2.8, 8.7, 100],
  ['Peanut butter', 588, 25, 20, 50, 16],
  ['Almonds', 579, 21.2, 21.6, 49.9, 30],
  ['Walnuts', 654, 15.2, 13.7, 65.2, 30],
  ['Cashews', 553, 18.2, 30.2, 43.9, 30],
  ['Peanuts', 567, 25.8, 16.1, 49.2, 30],
  ['Chia seeds', 486, 16.5, 42.1, 30.7, 15],
  ['Tahini', 595, 17, 21.2, 53.8, 15],
  // Fruit
  ['Banana', 89, 1.1, 22.8, 0.3, 120],
  ['Apple', 52, 0.3, 13.8, 0.2, 180],
  ['Orange', 47, 0.9, 11.8, 0.1, 150],
  ['Strawberries', 32, 0.7, 7.7, 0.3, 150],
  ['Blueberries', 57, 0.7, 14.5, 0.3, 100],
  ['Grapes', 69, 0.7, 18.1, 0.2, 100],
  ['Mango', 60, 0.8, 15, 0.4, 150],
  ['Watermelon', 30, 0.6, 7.6, 0.2, 250],
  ['Dates', 282, 2.5, 75, 0.4, 24],
  ['Avocado', 160, 2, 8.5, 14.7, 100],
  // Vegetables
  ['Broccoli', 34, 2.8, 6.6, 0.4, 100],
  ['Spinach', 23, 2.9, 3.6, 0.4, 60],
  ['Tomato', 18, 0.9, 3.9, 0.2, 120],
  ['Cucumber', 15, 0.7, 3.6, 0.1, 100],
  ['Carrot', 41, 0.9, 9.6, 0.2, 80],
  ['Onion', 40, 1.1, 9.3, 0.1, 80],
  ['Bell pepper', 31, 1, 6, 0.3, 120],
  ['Lettuce', 15, 1.4, 2.9, 0.2, 50],
  ['Green beans', 31, 1.8, 7, 0.2, 100],
  ['Mushrooms', 22, 3.1, 3.3, 0.3, 80],
  ['Sweetcorn', 96, 3.4, 21, 1.5, 80],
  // Fats, sweets & drinks
  ['Olive oil', 884, 0, 0, 100, 14],
  ['Vegetable oil', 884, 0, 0, 100, 14],
  ['Honey', 304, 0.3, 82.4, 0, 21],
  ['Sugar', 387, 0, 100, 0, 5],
  ['Dark chocolate, 70%', 598, 7.8, 45.9, 42.6, 25],
  ['Milk chocolate', 535, 7.7, 59.4, 29.7, 25],
  ['Orange juice', 45, 0.7, 10.4, 0.2, 250],
  ['Cola', 42, 0, 10.6, 0, 330],
];

export const BUILTIN_FOODS: Food[] = ROWS.map(([name, kcal, p, c, f, servingG]) => ({
  id: 'b-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  per100: { kcal, p, c, f },
  servingG,
  source: 'builtin',
}));

/** Rank foods against a typed query: every word must appear; earlier matches rank higher. */
export function searchFoods(foods: Food[], query: string): Food[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return foods;
  const scored: [number, Food][] = [];
  for (const food of foods) {
    const hay = (food.name + ' ' + (food.brand ?? '')).toLowerCase();
    let score = 0;
    let ok = true;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i < 0) {
        ok = false;
        break;
      }
      score += i === 0 ? 0 : hay[i - 1] === ' ' ? 1 : 3;
      score += i / 50;
    }
    if (ok) scored.push([score + hay.length / 200, food]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map((s) => s[1]);
}
