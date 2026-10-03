export const emptyState = () => ({
  items: [],
  purchases: [],
  orders: [],
  adjustments: [],
  expenses: [],
  settings: { whatsapp: '', storeName: 'CloudVibes' }
});

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1)
    .padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const id = () => crypto.randomUUID();

export const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(n) || 0);

export const categories = [
  'Jewellery',
  'Clothes',
  'Home Décor',
  'Pooja & Religious Items',
  'Electronics',
  'Other'
];

export function financials(o) {
  if (o.status === 'Cancelled') {
    return { netQty: 0, revenue: 0, cost: 0, profit: 0 };
  }

  const rr = o.resellable || 0;
  const rn = o.damagedReturn || 0;
  const netQty = o.qty - rr - rn;
  const revenue = netQty * o.price;
  const cost =
    (o.qty - rr) * o.unitCost +
    o.packCost + o.fee + o.shipping + o.other +
    (o.returnCost || 0) - (o.feeRefund || 0);

  return { netQty, revenue, cost, profit: revenue - cost };
}

export function metrics(db) {
  const f = db.orders.map(financials);
  const revenue = f.reduce((s, x) => s + x.revenue, 0);
  const direct = f.reduce((s, x) => s + x.cost, 0);
  const writeoff = db.adjustments.reduce(
    (s, x) => s + (x.loss || 0), 0
  );
  const overhead = db.expenses.reduce(
    (s, x) => s + x.amount, 0
  );

  return {
    revenue,
    direct,
    writeoff,
    overhead,
    profit: revenue - direct - writeoff - overhead,
    stockValue: db.items.reduce(
      (s, x) => s + x.stock * x.cost, 0
    )
  };
}

export function addProduct(db, input) {
  const p = {
    ...input,
    id: id(),
    stock: input.qty,
    cost: input.cost,
    recipe: input.recipe || []
  };

  delete p.qty;
  db.items.push(p);

  if (p.stock) {
    db.purchases.push({
      id: id(),
      itemId: p.id,
      name: p.name,
      date: today(),
      qty: p.stock,
      cost: p.cost,
      vendor: 'Opening stock',
      total: p.stock * p.cost
    });
  }

  return p;
}

export function buy(db, pid, qty, cost, extra, date, vendor) {
  const p = db.items.find(x => x.id === pid);

  if (!p) throw Error('Product not found');
  if (!(qty > 0) || cost < 0 || extra < 0) {
    throw Error('Enter valid purchase values');
  }

  const total = qty * cost + extra;
  p.cost = (p.stock * p.cost + total) / (p.stock + qty);
  p.stock += qty;

  db.purchases.unshift({
    id: id(),
    itemId: pid,
    name: p.name,
    qty,
    cost,
    total,
    extra,
    date,
    vendor
  });
}

export function sale(db, input) {
  const p = db.items.find(x => x.id === input.productId);
  const q = input.qty;

  if (!p || p.type !== 'Product') {
    throw Error('Choose a product');
  }

  if (!Number.isInteger(q) || q < 1 || p.stock < q) {
    throw Error('Not enough stock, or invalid quantity');
  }

  if (db.orders.some(x => x.ref === input.ref)) {
    throw Error('This order reference already exists');
  }

  const lines = (p.recipe || []).map(r => {
    const m = db.items.find(x => x.id === r.itemId);

    if (!m || m.stock < r.qty * q) {
      throw Error('Not enough packaging stock');
    }

    return {
      itemId: m.id,
      qty: r.qty * q,
      cost: m.cost,
      name: m.name
    };
  });

  for (const l of lines) {
    db.items.find(x => x.id === l.itemId).stock -= l.qty;
  }

  p.stock -= q;

  db.orders.unshift({
    ...input,
    id: id(),
    name: p.name,
    sku: p.sku,
    unitCost: p.cost,
    packaging: lines,
    packCost: lines.reduce((s, x) => s + x.qty * x.cost, 0),
    status: 'New',
    resellable: 0,
    damagedReturn: 0,
    returnCost: 0,
    feeRefund: 0
  });
}

export function returnSale(
  db, oid, qty, resellable, returnCost = 0, feeRefund = 0
) {
  const o = db.orders.find(x => x.id === oid);
  const p = db.items.find(x => x.id === o?.productId);

  if (
    !o || !p || o.status === 'Cancelled' ||
    !Number.isInteger(qty) || qty < 1 ||
    qty > financials(o).netQty
  ) {
    throw Error('Invalid return quantity');
  }

  if (
    returnCost < 0 || feeRefund < 0 ||
    feeRefund > (
      o.fee + o.shipping + o.other +
      o.returnCost + returnCost - o.feeRefund
    )
  ) {
    throw Error('Invalid return charges or refund');
  }

  if (resellable) {
    p.cost =
      (p.stock * p.cost + qty * o.unitCost) / (p.stock + qty);
    p.stock += qty;
    o.resellable += qty;
  } else {
    o.damagedReturn += qty;
  }

  o.returnCost += returnCost;
  o.feeRefund += feeRefund;
  o.status = financials(o).netQty === 0 ? 'Returned' : o.status;
  o.returns = o.returns || [];
  o.returns.push({
    date: today(), qty, resellable, returnCost, feeRefund
  });
}

export function cancelSale(db, oid) {
  const o = db.orders.find(x => x.id === oid);

  if (
    !o || o.status === 'Cancelled' ||
    o.resellable || o.damagedReturn
  ) {
    throw Error('This sale cannot be cancelled');
  }

  if (!['New', 'Ready to Dispatch'].includes(o.status)) {
    throw Error('Use Return for a dispatched or delivered order');
  }

  const p = db.items.find(x => x.id === o.productId);
  p.cost =
    (p.stock * p.cost + o.qty * o.unitCost) / (p.stock + o.qty);
  p.stock += o.qty;

  for (const l of o.packaging) {
    const m = db.items.find(x => x.id === l.itemId);
    m.cost =
      (m.stock * m.cost + l.qty * l.cost) / (m.stock + l.qty);
    m.stock += l.qty;
  }

  o.status = 'Cancelled';
}

export function adjust(db, pid, qty, type, note, date) {
  const p = db.items.find(x => x.id === pid);

  if (!p || qty <= 0 || p.stock < qty) {
    throw Error('Quantity exceeds available stock');
  }

  p.stock -= qty;

  db.adjustments.unshift({
    id: id(),
    itemId: pid,
    name: p.name,
    qty,
    type,
    note,
    date,
    loss: qty * p.cost
  });
}

export function isValidImage(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }

  if (/^\/(?!\/)[^\s\\?#]+$/.test(value)) return true;

  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function validateState(db) {
  if (
    !db ||
    !Array.isArray(db.items) ||
    !Array.isArray(db.orders) ||
    !Array.isArray(db.purchases) ||
    !Array.isArray(db.adjustments) ||
    !Array.isArray(db.expenses) ||
    !db.settings ||
    typeof db.settings !== 'object'
  ) {
    throw Error('Invalid inventory data');
  }

  const ids = new Set();

  for (const p of db.items) {
    if (
      !p.id || ids.has(p.id) ||
      typeof p.name !== 'string' || !p.name.trim() ||
      !['Product', 'Packaging'].includes(p.type)
    ) {
      throw Error('Invalid or duplicate product');
    }

    ids.add(p.id);

    for (const k of ['stock', 'cost', 'price']) {
      if (!Number.isFinite(p[k]) || p[k] < 0) {
        throw Error('Invalid product values');
      }
    }

    if (p.image && !isValidImage(p.image)) {
      throw Error('Invalid image reference');
    }

    if (p.media !== undefined) {
      if (!Array.isArray(p.media) || p.media.length > 12) {
        throw Error('Maximum 12 media files per product');
      }

      for (const m of p.media) {
        if (
          !m ||
          !['image', 'video'].includes(m.type) ||
          !isValidImage(m.url)
        ) {
          throw Error('Invalid media reference');
        }

        if (m.type === 'video') {
          let u;

          try {
            u = new URL(m.url);
          } catch {
            throw Error('Invalid video link');
          }

          if (
            u.protocol !== 'https:' ||
            u.hostname !== 'res.cloudinary.com' ||
            !u.pathname.includes('/video/upload/')
          ) {
            throw Error('Invalid video link');
          }
        }
      }
    }

    if (!Array.isArray(p.recipe)) {
      throw Error('Invalid packaging setup');
    }

    const seen = new Set();

    for (const r of p.recipe) {
      if (
        seen.has(r.itemId) ||
        !Number.isFinite(r.qty) || r.qty <= 0
      ) {
        throw Error('Invalid packaging quantity');
      }

      seen.add(r.itemId);
    }
  }

  for (const p of db.items) {
    for (const r of p.recipe) {
      if (!db.items.some(m =>
        m.id === r.itemId && m.type === 'Packaging'
      )) {
        throw Error('Packaging item not found');
      }
    }
  }

  for (const o of db.orders) {
    for (const k of [
      'qty', 'price', 'unitCost', 'packCost', 'fee',
      'shipping', 'other', 'resellable', 'damagedReturn',
      'returnCost', 'feeRefund'
    ]) {
      if (!Number.isFinite(o[k]) || o[k] < 0) {
        throw Error('Invalid sale values');
      }
    }

    if (
      o.resellable + o.damagedReturn > o.qty ||
      !Number.isInteger(o.qty)
    ) {
      throw Error('Invalid sale quantity');
    }
  }

  for (const x of db.expenses) {
    if (!Number.isFinite(x.amount) || x.amount < 0) {
      throw Error('Invalid expense');
    }
  }

  return true;
}

export function publicProducts(db) {
  return db.items
    .filter(x => x.type === 'Product' && x.published)
    .map(x => ({
      id: x.id,
      name: x.name,
      category: x.category,
      subcategory: x.subcategory,
      description: x.description || '',
      price: x.price,
      image: x.image || '',
      media: (x.media || []).map(m => ({
        type: m.type,
        url: m.url
      })),
      available: x.stock > 0
    }));
}

export function advanceStatus(db, oid, status) {
  const stages = [
    'New', 'Ready to Dispatch', 'Dispatched', 'Delivered'
  ];

  const o = db.orders.find(x => x.id === oid);

  if (
    !o ||
    !stages.includes(o.status) ||
    !stages.includes(status) ||
    stages.indexOf(status) < stages.indexOf(o.status)
  ) {
    throw Error(
      'Order status cannot move backwards. ' +
      'Use a return for dispatched orders.'
    );
  }

  o.status = status;
}
