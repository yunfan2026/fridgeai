import { useEffect, useState } from 'react';
import { fetchRecipes } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { daysLeft } from '../lib/expiry.js';

export default function RecipesView({ user, inventory }) {
  const showToast = useToast();
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { items } = inventory;

  const load = async () => {
    if (!items.length) {
      setRecipes([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Send inventory with live days-left so the model prioritizes what's expiring.
      const payload = items.map((i) => ({
        name: i.name,
        location: i.location,
        quantity: i.quantity,
        daysLeft: daysLeft(i.expires_at),
      }));
      const { recipes: r } = await fetchRecipes(payload);
      setRecipes(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load once when inventory first becomes available.
  useEffect(() => {
    if (recipes === null && items.length) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // "Cook this": deduct each matched inventory item by one unit / one portion step.
  const cook = async (recipe) => {
    const ingredients = (recipe.ingredients || []).map((s) => s.toLowerCase());
    const undos = [];
    let deducted = 0;
    for (const item of items) {
      const core = item.name.toLowerCase().replace(/s$/, '');
      const used = ingredients.some((ing) => ing.includes(core) && core.length > 2);
      if (!used) continue;
      deducted += 1;
      if (item.tracking_type === 'portion') {
        const next = Math.max(0, Number((item.portion_remaining - 0.25).toFixed(2)));
        undos.push(await inventory.setPortion(item, next, user.id));
      } else {
        undos.push(await inventory.stepQuantity(item, -1, user.id));
      }
    }
    if (deducted === 0) {
      showToast('No matching items to deduct');
      return;
    }
    showToast(`Cooked — deducted ${deducted} item${deducted === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      onAction: () => undos.forEach((u) => u?.()),
    });
  };

  return (
    <div className="px-4">
      <div className="flex items-center py-2">
        <h2 className="text-lg font-bold">Recipes</h2>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-card disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>
      <p className="mb-3 text-sm text-ink/50">Using ingredients expiring soonest.</p>

      {loading && <p className="py-8 text-center text-ink/40">Asking the kitchen assistant…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && recipes && recipes.length === 0 && (
        <div className="py-12 text-center text-ink/50">
          <div className="text-4xl">🍳</div>
          <p className="mt-2">Add items to your inventory first, then come back for ideas.</p>
        </div>
      )}

      <div className="space-y-3">
        {(recipes || []).map((r, i) => (
          <RecipeCard key={i} recipe={r} onCook={() => cook(r)} />
        ))}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onCook }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white p-4 shadow-card">
      <div className="font-bold">{recipe.name}</div>
      <div className="mt-0.5 text-sm text-accent">{recipe.reason}</div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-ink/5 px-3 py-1.5 text-sm font-semibold text-ink/70"
        >
          {open ? 'Hide details ▴' : 'Show details ▾'}
        </button>
        <button
          onClick={onCook}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
        >
          🍳 Cooked this
        </button>
      </div>

      {open && (
        <div className="mt-3 text-sm">
          {recipe.ingredients?.length > 0 && (
            <>
              <div className="text-xs font-bold uppercase tracking-wide text-ink/40">Ingredients</div>
              <ul className="mt-1 list-disc pl-5 text-ink/80">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-2 text-xs font-bold uppercase tracking-wide text-ink/40">Steps</div>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink/80">
            {(recipe.steps || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
