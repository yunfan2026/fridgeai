// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE_INVENTORY = 'fridgeai_inventory';
const STORAGE_WASTELOG  = 'fridgeai_wastelog';

// ── Demo inventory — pre-loaded on first visit ─────────────────────────────────
const DEMO_INVENTORY = [
  { id: uid(), name: 'Spinach',              location: 'Fridge',  daysLeft: 1,   quantity: 1,  unit: 'bag',       addedAt: Date.now() },
  { id: uid(), name: 'Chicken Breast',       location: 'Fridge',  daysLeft: 2,   quantity: 2,  unit: 'pieces',    addedAt: Date.now() },
  { id: uid(), name: 'Avocado',              location: 'Fridge',  daysLeft: 2,   quantity: 2,  unit: 'pieces',    addedAt: Date.now() },
  { id: uid(), name: 'Milk',                 location: 'Fridge',  daysLeft: 4,   quantity: 1,  unit: 'bottle',    addedAt: Date.now() },
  { id: uid(), name: 'Greek Yogurt',         location: 'Fridge',  daysLeft: 5,   quantity: 2,  unit: 'container', addedAt: Date.now() },
  { id: uid(), name: 'Cheddar Cheese',       location: 'Fridge',  daysLeft: 8,   quantity: 1,  unit: 'block',     addedAt: Date.now() },
  { id: uid(), name: 'Eggs',                 location: 'Fridge',  daysLeft: 14,  quantity: 6,  unit: 'eggs',      addedAt: Date.now() },
  { id: uid(), name: 'Salmon Fillet',        location: 'Freezer', daysLeft: 45,  quantity: 2,  unit: 'pieces',    addedAt: Date.now() },
  { id: uid(), name: 'Frozen Peas',          location: 'Freezer', daysLeft: 60,  quantity: 1,  unit: 'bag',       addedAt: Date.now() },
  { id: uid(), name: 'Frozen Chicken Wings', location: 'Freezer', daysLeft: 30,  quantity: 8,  unit: 'pieces',    addedAt: Date.now() },
  { id: uid(), name: 'Bread',                location: 'Pantry',  daysLeft: 4,   quantity: 12, unit: 'slices',    addedAt: Date.now() },
  { id: uid(), name: 'Pasta',                location: 'Pantry',  daysLeft: 365, quantity: 1,  unit: 'box',       addedAt: Date.now() },
  { id: uid(), name: 'Canned Tomatoes',      location: 'Pantry',  daysLeft: 365, quantity: 3,  unit: 'cans',      addedAt: Date.now() },
  { id: uid(), name: 'Rice',                 location: 'Pantry',  daysLeft: 365, quantity: 1,  unit: 'bag',       addedAt: Date.now() },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Default units by food type — used to pre-fill the unit field in scan review
const DEFAULT_UNITS = {
  // Bread & bakery
  bread: 'slices', bagel: 'pieces', tortilla: 'pieces', roll: 'pieces',
  // Grains & bulk dry goods — natural container units
  rice: 'bag', pasta: 'box', flour: 'bag', oat: 'bag', oats: 'bag',
  // Dairy — natural container units
  milk: 'bottle', cream: 'bottle',
  'greek yogurt': 'container', yogurt: 'container',
  cheese: 'block', 'cheddar cheese': 'block', mozzarella: 'block',
  parmesan: 'block', feta: 'block',
  butter: 'block',
  // Eggs
  egg: 'eggs', eggs: 'eggs',
  // Produce — all countable by piece, no halves
  avocado: 'pieces', banana: 'pieces', apple: 'pieces', orange: 'pieces',
  lemon: 'pieces', lime: 'pieces', tomato: 'pieces', tomatoes: 'pieces',
  mushroom: 'pieces', mushrooms: 'pieces', pepper: 'pieces', peppers: 'pieces',
  carrot: 'pieces', carrots: 'pieces', celery: 'stalks',
  // Produce — leafy / bulk → bag
  spinach: 'bag', lettuce: 'bag', kale: 'bag', salad: 'bag', arugula: 'bag',
  broccoli: 'head', cauliflower: 'head',
  // Meat & fish
  chicken: 'pieces', 'chicken breast': 'pieces', 'chicken thigh': 'pieces',
  salmon: 'pieces', fish: 'pieces', shrimp: 'bag',
  beef: 'pieces', 'ground beef': 'pack', pork: 'pieces', bacon: 'pack', ham: 'pack',
  // Pantry / canned
  'canned tomatoes': 'cans', 'canned beans': 'cans',
};

function defaultUnit(itemName) {
  const key = itemName.toLowerCase().trim();
  for (const [food, unit] of Object.entries(DEFAULT_UNITS)) {
    if (key.includes(food)) return unit;
  }
  return 'pieces';
}

function loadInventory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_INVENTORY)) || []; }
  catch { return []; }
}

function saveInventory(items) {
  localStorage.setItem(STORAGE_INVENTORY, JSON.stringify(items));
}

function loadWasteLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_WASTELOG)) || []; }
  catch { return []; }
}

function saveWasteLog(log) {
  localStorage.setItem(STORAGE_WASTELOG, JSON.stringify(log));
}

// Convert a daysLeft number into a YYYY-MM-DD string for <input type="date">
function daysLeftToDateInput(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return '';
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  return d.toISOString().slice(0, 10);
}

// Convert a YYYY-MM-DD date string to days from today
function dateInputToDaysLeft(dateStr) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry - today) / 86400000);
}

// Expiry chip CSS class
function expiryChipClass(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'chip-unknown';
  if (daysLeft < 0)  return 'chip-expired';
  if (daysLeft <= 2) return 'chip-urgent';
  if (daysLeft <= 5) return 'chip-warn';
  return 'chip-safe';
}

// Expiry chip label — shows actual date for items with > 30 days left
function expiryChipLabel(daysLeft, addedAt) {
  if (daysLeft === null || daysLeft === undefined) return '⚠️ Check soon';
  if (daysLeft < 0)   return `Expired ${Math.abs(daysLeft)}d ago`;
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return 'Expires tomorrow';
  if (daysLeft <= 30) return `${daysLeft}d left`;
  // For longer-lived items, compute and show the actual expiry date
  const base = addedAt || Date.now();
  const expiryDate = new Date(base + daysLeft * 86400000);
  return `Exp. ${expiryDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

// ── Tab switching ──────────────────────────────────────────────────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const views   = document.querySelectorAll('.view');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    views.forEach(v => v.classList.toggle('active', v.id === `view-${tab}`));
    if (tab === 'inventory') renderInventory();
    if (tab === 'recipes')   loadRecipes();
  });
});

// ── SCAN VIEW ─────────────────────────────────────────────────────────────────
const photoInput    = document.getElementById('photo-input');
const uploadZone    = document.getElementById('upload-zone');
const scanPreview   = document.getElementById('scan-preview');
const scanLoading   = document.getElementById('scan-loading');
const demoBadge     = document.getElementById('demo-badge');
const scanResults   = document.getElementById('scan-results');
const detectedItems = document.getElementById('detected-items');
const saveItemsBtn  = document.getElementById('save-items-btn');

photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  scanPreview.src = URL.createObjectURL(file);
  scanPreview.classList.remove('hidden');
  uploadZone.classList.add('hidden');
  scanResults.classList.add('hidden');
  demoBadge.classList.add('hidden');
  scanLoading.classList.remove('hidden');

  try {
    const base64 = await fileToBase64(file);
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');
    if (data.demo) demoBadge.classList.remove('hidden');
    renderDetectedItems(data.items);
  } catch (err) {
    scanLoading.classList.add('hidden');
    demoBadge.textContent = `Error: ${err.message}`;
    demoBadge.classList.remove('hidden');
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderDetectedItems(items) {
  scanLoading.classList.add('hidden');
  detectedItems.innerHTML = '';

  items.forEach((item) => {
    const defaultDate = daysLeftToDateInput(item.daysLeft);
    const unit = defaultUnit(item.name);
    const row = document.createElement('div');
    row.className = 'detected-item';
    row.innerHTML = `
      <input class="di-name" type="text" value="${escHtml(item.name)}" placeholder="Item name">
      <div class="di-controls">
        <div class="di-field">
          <label class="di-label">Qty</label>
          <input class="di-qty" type="number" min="0.5" step="0.5" value="1">
        </div>
        <div class="di-field">
          <label class="di-label">Unit</label>
          <input class="di-unit" type="text" value="${escHtml(unit)}" placeholder="pieces">
        </div>
        <div class="di-field">
          <label class="di-label">Location</label>
          <select class="di-loc">
            <option value="Fridge"  ${item.location === 'Fridge'  ? 'selected' : ''}>Fridge</option>
            <option value="Freezer" ${item.location === 'Freezer' ? 'selected' : ''}>Freezer</option>
            <option value="Pantry"  ${item.location === 'Pantry'  ? 'selected' : ''}>Pantry</option>
          </select>
        </div>
        <div class="di-field">
          <label class="di-label">Expiry date</label>
          <input class="di-date" type="date" value="${defaultDate}">
        </div>
        <button class="remove-detected" title="Remove">✕</button>
      </div>
    `;
    row.querySelector('.remove-detected').addEventListener('click', () => row.remove());
    detectedItems.appendChild(row);
  });

  scanResults.classList.remove('hidden');
}

saveItemsBtn.addEventListener('click', () => {
  const rows = detectedItems.querySelectorAll('.detected-item');
  const inventory = loadInventory();
  const now = Date.now();

  rows.forEach(row => {
    const name     = row.querySelector('.di-name').value.trim();
    const qty      = parseFloat(row.querySelector('.di-qty').value) || 1;
    const unit     = row.querySelector('.di-unit').value.trim() || 'pieces';
    const location = row.querySelector('.di-loc').value;
    const dateStr  = row.querySelector('.di-date').value;
    if (!name) return;

    inventory.push({
      id: uid(),
      name,
      location,
      daysLeft: dateInputToDaysLeft(dateStr),
      quantity: qty,
      unit,
      addedAt: now,
    });
  });

  saveInventory(inventory);

  // Reset scan view
  scanPreview.classList.add('hidden');
  uploadZone.classList.remove('hidden');
  scanResults.classList.add('hidden');
  demoBadge.classList.add('hidden');
  photoInput.value = '';

  // Switch to inventory
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'inventory'));
  views.forEach(v => v.classList.toggle('active', v.id === 'view-inventory'));
  renderInventory();
});

// ── INVENTORY VIEW ─────────────────────────────────────────────────────────────
const inventorySummary = document.getElementById('inventory-summary');
const inventoryGroups  = document.getElementById('inventory-groups');
const inventoryEmpty   = document.getElementById('inventory-empty');

function renderInventory() {
  const inventory = loadInventory();
  const wasteLog  = loadWasteLog();

  // Summary bar
  const urgentCount = inventory.filter(i => i.daysLeft !== null && i.daysLeft <= 3).length;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentLog = wasteLog.filter(e => Date.now() - e.timestamp < weekMs);
  const consumed = recentLog.filter(e => e.reason === 'consumed').reduce((s, e) => s + (e.qty || 1), 0);
  const thrown   = recentLog.filter(e => e.reason === 'thrown').reduce((s, e) => s + (e.qty || 1), 0);

  inventorySummary.innerHTML = `
    <span class="stat">
      <span class="stat-num ${urgentCount > 0 ? 'stat-warn' : ''}">${urgentCount}</span>
      expiring within 3 days
    </span>
    <span class="stat">
      <span class="stat-num">${consumed}</span> consumed this week
    </span>
    <span class="stat">
      <span class="stat-num ${thrown > 0 ? 'stat-warn' : ''}">${thrown}</span> thrown away this week
    </span>
  `;

  inventoryGroups.innerHTML = '';

  if (!inventory.length) {
    inventoryEmpty.classList.remove('hidden');
    return;
  }
  inventoryEmpty.classList.add('hidden');

  const locations = ['Fridge', 'Freezer', 'Pantry'];
  locations.forEach(loc => {
    const items = inventory
      .filter(i => i.location === loc)
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

    if (!items.length) return;

    const group = document.createElement('div');
    group.className = 'location-group';
    group.innerHTML = `<div class="location-heading">${loc}</div><div class="item-cards"></div>`;
    const cardContainer = group.querySelector('.item-cards');
    items.forEach(item => cardContainer.appendChild(buildItemCard(item)));
    inventoryGroups.appendChild(group);
  });
}

function buildItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.id = item.id;

  const chipClass = expiryChipClass(item.daysLeft);
  const chipLabel = expiryChipLabel(item.daysLeft, item.addedAt);

  card.innerHTML = `
    <div class="item-info">
      <div class="item-name">${escHtml(item.name)}</div>
      <div class="item-meta">
        <span class="expiry-chip ${chipClass}">${chipLabel}</span>
        <span class="item-qty">× ${item.quantity}${item.unit ? ' ' + item.unit : ''}</span>
      </div>
    </div>
    <div class="item-actions">
      <button class="remove-btn" title="Remove item">−</button>
    </div>
  `;

  card.querySelector('.remove-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showRemoveConfirm(card, item);
  });

  return card;
}

function showRemoveConfirm(card, item) {
  const unit = item.unit ? ` ${item.unit}` : '';
  const actionsEl = card.querySelector('.item-actions');
  actionsEl.innerHTML = `
    <div class="remove-confirm">
      <div class="consume-row">
        <span class="consume-label">Consumed</span>
        <input class="consume-qty" type="number" min="0.5" step="0.5" max="${item.quantity}" value="${item.quantity}">
        <span class="consume-of">/ ${item.quantity}${unit}</span>
        <button class="reason-btn reason-consumed">✓</button>
      </div>
      <button class="reason-btn reason-thrown">🗑 Threw away</button>
    </div>
  `;

  actionsEl.querySelector('.reason-consumed').addEventListener('click', () => {
    const qtyInput = actionsEl.querySelector('.consume-qty');
    const consumed = Math.min(parseFloat(qtyInput.value) || 1, item.quantity);
    removeItem(item.id, 'consumed', consumed);
  });

  actionsEl.querySelector('.reason-thrown').addEventListener('click', () => {
    removeItem(item.id, 'thrown', item.quantity);
  });
}

function removeItem(id, reason, qty = 1) {
  const inventory = loadInventory();
  const idx = inventory.findIndex(i => i.id === id);
  if (idx === -1) return;

  const item = inventory[idx];

  // Log to waste tracking
  const log = loadWasteLog();
  log.push({ id: uid(), name: item.name, reason, qty, timestamp: Date.now() });
  saveWasteLog(log);

  if (qty >= item.quantity) {
    // Remove item entirely
    inventory.splice(idx, 1);
  } else {
    // Reduce quantity
    inventory[idx] = { ...item, quantity: item.quantity - qty };
  }

  saveInventory(inventory);
  renderInventory();
}

// ── RECIPES VIEW ───────────────────────────────────────────────────────────────
const recipesList    = document.getElementById('recipes-list');
const recipesLoading = document.getElementById('recipes-loading');
const recipesEmpty   = document.getElementById('recipes-empty');
const recipesError   = document.getElementById('recipes-error');
const refreshBtn     = document.getElementById('refresh-recipes-btn');

let recipesLoaded = false;

refreshBtn.addEventListener('click', () => loadRecipes(true));

async function loadRecipes(force = false) {
  if (recipesLoaded && !force) return;

  const inventory = loadInventory();
  if (!inventory.length) {
    recipesList.innerHTML = '';
    recipesEmpty.classList.remove('hidden');
    recipesError.classList.add('hidden');
    return;
  }

  recipesEmpty.classList.add('hidden');
  recipesError.classList.add('hidden');
  recipesList.innerHTML = '';
  recipesLoading.classList.remove('hidden');

  try {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recipe fetch failed');
    renderRecipes(data.recipes);
    recipesLoaded = true;
  } catch (err) {
    recipesError.textContent = err.message;
    recipesError.classList.remove('hidden');
  } finally {
    recipesLoading.classList.add('hidden');
  }
}

function renderRecipes(recipes) {
  recipesList.innerHTML = '';
  if (!recipes || !recipes.length) {
    recipesEmpty.classList.remove('hidden');
    return;
  }

  const container = document.createElement('div');
  container.className = 'recipe-cards';

  recipes.forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const ingredients = (recipe.ingredients || []).map(i => `<li>${escHtml(i)}</li>`).join('');
    const steps = (recipe.steps || []).map(s => `<li>${escHtml(s)}</li>`).join('');
    card.innerHTML = `
      <div class="recipe-header">
        <div class="recipe-name">${escHtml(recipe.name)}</div>
        <div class="recipe-reason">${escHtml(recipe.reason)}</div>
        <span class="recipe-toggle">Show details ▾</span>
      </div>
      <div class="recipe-steps">
        ${ingredients ? `<div class="recipe-section-label">Ingredients</div><ul class="recipe-ingredients">${ingredients}</ul>` : ''}
        <div class="recipe-section-label">Steps</div>
        <ol class="recipe-step-list">${steps}</ol>
      </div>
    `;
    card.querySelector('.recipe-header').addEventListener('click', () => {
      const open = card.classList.toggle('open');
      card.querySelector('.recipe-toggle').textContent = open ? 'Hide details ▴' : 'Show details ▾';
    });
    container.appendChild(card);
  });

  recipesList.appendChild(container);
}

// ── Escape HTML ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
(function init() {
  if (!localStorage.getItem(STORAGE_INVENTORY)) {
    saveInventory(DEMO_INVENTORY);
  }
  renderInventory();
})();
