import { useMemo, useState } from 'react';
import type { Food, Recipe, RecipeIngredient } from '../lib/types';
import { allFoods, getState, logRecipe, recentFoods, recipeTotals, replaceState, saveRecipe, uid, update, useApp } from '../lib/store';
import { searchFoods } from '../lib/foods';
import { fmtRelative } from '../lib/date';
import { num, scale } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { MacroStrip, NumField, TextField, toast } from '../ui/bits';

/** The Recipes tab inside Log food: saved recipes, tap one to log portions. */
export function RecipeList({ onPick, onNew }: { onPick: (r: Recipe) => void; onNew: () => void }) {
  const s = useApp();
  return (
    <>
      <button className="btn wide" onClick={onNew}>
        <Icon name="plus" /> New recipe
      </button>
      {s.recipes.length === 0 ? (
        <p className="hint">Combine foods into one dish, e.g. 100 g rice + 150 g chicken, then log it by portion.</p>
      ) : (
        <div className="rows">
          {s.recipes.map((r) => {
            const per = recipeTotals(r).perPortion;
            return (
              <button key={r.id} className="row" onClick={() => onPick(r)}>
                <span className="row-main">
                  <span className="row-title">{r.name}</span>
                  <span className="row-sub">
                    {r.ingredients.length} ingredients · {r.portions} {r.portions === 1 ? 'portion' : 'portions'} · P {num(per.p, 0)} · C {num(per.c, 0)} · F{' '}
                    {num(per.f, 0)} per portion
                  </span>
                </span>
                <span className="row-end">
                  {Math.round(per.kcal)}
                  <small>kcal</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Choose how many portions to log. */
export function LogRecipe({ recipe, date, onDone, onEdit }: { recipe: Recipe; date: string; onDone: () => void; onEdit: () => void }) {
  const [portions, setPortions] = useState<number | null>(1);
  const per = recipeTotals(recipe).perPortion;
  const n = portions ?? 0;
  const valid = n > 0 && n <= 20;
  const add = () => {
    if (!valid) return;
    logRecipe(recipe, n, date);
    toast(`${recipe.name} added`);
    onDone();
  };
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <div>
        <h3 className="food-title">{recipe.name}</h3>
        <p className="session-meta" style={{ marginBottom: 0 }}>
          Makes {recipe.portions} {recipe.portions === 1 ? 'portion' : 'portions'} · {Math.round(per.kcal)} kcal each
        </p>
      </div>
      <NumField label="Portions" value={portions} onChange={setPortions} autoFocus maxLength={4} />
      <div className="chips">
        {[0.5, 1, 1.5, 2].map((v) => (
          <button type="button" key={v} className="chip" aria-pressed={portions === v} onClick={() => setPortions(v)}>
            {v === 0.5 ? '½' : v === 1.5 ? '1½' : v}
          </button>
        ))}
      </div>
      <MacroStrip m={{ kcal: per.kcal * n, p: per.p * n, c: per.c * n, f: per.f * n }} />
      <button className="btn wide" disabled={!valid}>
        Add to log
      </button>
      <button type="button" className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={onEdit}>
        <Icon name="edit" /> Edit recipe
      </button>
    </form>
  );
}

/** Create or change a recipe: name, portions, and ingredients with amounts. */
export function RecipeEditor({ recipe, onSaved, onClose }: { recipe: Recipe | null; onSaved: (r: Recipe) => void; onClose: () => void }) {
  const [r, setR] = useState<Recipe>(recipe ?? { id: uid(), name: '', portions: 1, ingredients: [] });
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { total, perPortion } = recipeTotals(r);
  const valid = r.name.trim() !== '' && r.ingredients.length > 0 && r.portions > 0;
  const setIngredient = (i: number, patch: Partial<RecipeIngredient>) =>
    setR({ ...r, ingredients: r.ingredients.map((g, j) => (j === i ? { ...g, ...patch } : g)) });

  if (adding) {
    return (
      <IngredientPicker
        onClose={() => setAdding(false)}
        onPick={(g) => {
          setR({ ...r, ingredients: [...r.ingredients, g] });
          setAdding(false);
        }}
      />
    );
  }

  return (
    <Sheet
      title={recipe ? 'Edit recipe' : 'New recipe'}
      onClose={onClose}
      full
      foot={
        <button
          className="btn wide"
          disabled={!valid}
          onClick={() => {
            const clean = { ...r, name: r.name.trim().slice(0, 60) };
            saveRecipe(clean);
            toast('Recipe saved');
            onSaved(clean);
          }}
        >
          Save recipe
        </button>
      }
    >
      <div className="stack">
        <TextField label="Name" value={r.name} onChange={(v) => setR({ ...r, name: v })} placeholder="e.g. Chicken and rice" autoFocus={!recipe} />
        <NumField
          label="Portions it makes"
          value={r.portions}
          onChange={(v) => v != null && v > 0 && setR({ ...r, portions: Math.min(100, v) })}
          maxLength={3}
        />
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Ingredients
          </div>
          {r.ingredients.length === 0 && <p className="hint">No ingredients yet.</p>}
          <div className="rows">
            {r.ingredients.map((g, i) => (
              <div key={i} className="row ingredient-row">
                <span className="row-main">
                  <span className="row-title">{g.name}</span>
                  <span className="row-sub">{Math.round((g.per100.kcal * g.grams) / 100)} kcal</span>
                </span>
                <span className="ingredient-amount">
                  <NumField value={g.grams} onChange={(v) => v != null && v > 0 && setIngredient(i, { grams: Math.min(v, 5000) })} unit={g.liquid ? 'ml' : 'g'} dp={0} maxLength={5} placeholder={`${g.name} amount`} />
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${g.name}`}
                  onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add ingredient
          </button>
        </div>
        {r.ingredients.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Per portion · whole recipe {Math.round(total.kcal).toLocaleString('en-US')} kcal
            </div>
            <MacroStrip m={perPortion} />
          </div>
        )}
        {recipe &&
          (confirmDelete ? (
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const before = getState();
                  update((d) => {
                    d.recipes = d.recipes.filter((x) => x.id !== recipe.id);
                  });
                  toast('Recipe deleted. Logged meals are kept.', { label: 'Undo', run: () => replaceState(before) });
                  onClose();
                }}
              >
                Delete recipe
              </button>
            </div>
          ) : (
            <button className="btn quiet" style={{ alignSelf: 'flex-start', color: 'var(--danger)', marginLeft: -10 }} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" /> Delete recipe
            </button>
          ))}
      </div>
    </Sheet>
  );
}

/** Pick a food (built-in, your own, or scanned earlier), then its amount. */
function IngredientPicker({ onPick, onClose }: { onPick: (g: RecipeIngredient) => void; onClose: () => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const query = q.trim();
  const results = useMemo(() => (query ? searchFoods(allFoods(s), query).slice(0, 40) : recentFoods(s)), [s, query]);

  if (food) {
    const unit = food.liquid ? 'ml' : 'g';
    const valid = grams != null && grams > 0 && grams <= 5000;
    const add = () =>
      valid &&
      onPick({ foodId: food.id, name: food.name, grams: grams!, per100: { ...food.per100 }, ...(food.liquid ? { liquid: true } : {}) });
    return (
      <Sheet title="Amount" onClose={onClose} onBack={() => setFood(null)}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <h3 className="food-title">{food.name}</h3>
          <NumField label="Amount in the whole recipe" unit={unit} value={grams} onChange={setGrams} autoFocus dp={0} maxLength={5} />
          <div className="chips">
            {[50, 100, 150, 200, 250].map((g) => (
              <button type="button" key={g} className="chip" aria-pressed={grams === g} onClick={() => setGrams(g)}>
                {g} {unit}
              </button>
            ))}
          </div>
          <MacroStrip m={scale(food.per100, grams ?? 0)} />
          <button className="btn wide" disabled={!valid}>
            Add to recipe
          </button>
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet title="Add ingredient" onClose={onClose} full>
      <div className="stack">
        <input
          className="input"
          placeholder="Search foods, e.g. rice"
          aria-label="Search ingredients"
          value={q}
          autoFocus
          dir="auto"
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
        />
        {!query && results.length > 0 && <div className="label">Recent</div>}
        {query && results.length === 0 && <p className="hint">No match for “{query}”. Scan or create the food first, then add it here.</p>}
        <div className="rows">
          {results.map((f) => (
            <button
              key={f.id}
              className="row"
              onClick={() => {
                setFood(f);
                setGrams(f.servingG ?? 100);
              }}
            >
              <span className="row-main">
                <span className="row-title">{f.name}</span>
                <span className="row-sub">{Math.round(f.per100.kcal)} kcal per 100 {f.liquid ? 'ml' : 'g'}</span>
              </span>
              <Icon name="plus" />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** Title for the log-portions sheet. */
export const logRecipeTitle = (date: string) => `Add to ${fmtRelative(date).toLowerCase()}`;
