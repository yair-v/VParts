const path = require('path');
const Database = require('better-sqlite3');

let db;

function initDatabase(userDataPath) {
  if (db) return db;

  const dbPath = path.join(userDataPath, 'vparts.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      document_name TEXT,
      document_type TEXT,
      document_path TEXT,
      theme_mode TEXT DEFAULT 'dark',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER NOT NULL,
      page INTEGER DEFAULT 1,
      part_ref TEXT,
      pn TEXT NOT NULL,
      description TEXT,
      type TEXT,
      sort_index INTEGER DEFAULT 0,
      FOREIGN KEY (catalog_id) REFERENCES catalogs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER NOT NULL,
      part_id INTEGER,
      page INTEGER DEFAULT 1,
      x REAL NOT NULL,
      y REAL NOT NULL,
      FOREIGN KEY (catalog_id) REFERENCES catalogs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      order_date TEXT,
      requester TEXT,
      department TEXT,
      machine_name TEXT,
      supplier_email TEXT,
      general_notes TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      part_id INTEGER,
      pn TEXT,
      description TEXT,
      qty INTEGER DEFAULT 1,
      urgency TEXT,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  try {
    const cols = db.prepare(`PRAGMA table_info(orders)`).all();
    const hasOrderDate = cols.some(c => c.name === 'order_date');
    if (!hasOrderDate) db.exec(`ALTER TABLE orders ADD COLUMN order_date TEXT`);
  } catch (e) {}

  return db;
}

function saveCatalog(payload) {
  const {
    id,
    name,
    documentName,
    documentType,
    documentPath,
    themeMode,
    parts = [],
    hotspots = []
  } = payload;

  const now = new Date().toISOString();

  const insertCatalog = db.prepare(`
    INSERT INTO catalogs (name, document_name, document_type, document_path, theme_mode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateCatalog = db.prepare(`
    UPDATE catalogs
    SET name = ?, document_name = ?, document_type = ?, document_path = ?, theme_mode = ?, updated_at = ?
    WHERE id = ?
  `);

  const deleteParts = db.prepare(`DELETE FROM parts WHERE catalog_id = ?`);
  const deleteHotspots = db.prepare(`DELETE FROM hotspots WHERE catalog_id = ?`);

  const insertPart = db.prepare(`
    INSERT INTO parts (catalog_id, page, part_ref, pn, description, type, sort_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHotspot = db.prepare(`
    INSERT INTO hotspots (catalog_id, part_id, page, x, y)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    let catalogId = id;
    if (catalogId) {
      updateCatalog.run(name, documentName, documentType, documentPath, themeMode || 'dark', now, catalogId);
      deleteParts.run(catalogId);
      deleteHotspots.run(catalogId);
    } else {
      catalogId = insertCatalog.run(
        name,
        documentName,
        documentType,
        documentPath,
        themeMode || 'dark',
        now,
        now
      ).lastInsertRowid;
    }

    const idMap = new Map();

    parts.forEach((part, index) => {
      const inserted = insertPart.run(
        catalogId,
        Number(part.page || 1),
        String(part.partRef || ''),
        String(part.pn || ''),
        String(part.description || ''),
        String(part.type || ''),
        index + 1
      );
      idMap.set(String(part.clientId || part.id || index + 1), Number(inserted.lastInsertRowid));
    });

    hotspots.forEach((hotspot) => {
      const mappedPartId =
        idMap.get(String(hotspot.partClientId || hotspot.partId || '')) ||
        Number(hotspot.partDbId || hotspot.partId || 0) ||
        null;

      insertHotspot.run(
        catalogId,
        mappedPartId,
        Number(hotspot.page || 1),
        Number(hotspot.x || 0),
        Number(hotspot.y || 0)
      );
    });

    return Number(catalogId);
  });

  return getCatalog(tx());
}

function listCatalogs() {
  return db.prepare(`
    SELECT c.id, c.name, c.document_name, c.document_type, c.theme_mode, c.created_at, c.updated_at,
           COUNT(p.id) AS parts_count
    FROM catalogs c
    LEFT JOIN parts p ON p.catalog_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC, c.id DESC
  `).all();
}

function getCatalog(id) {
  const catalog = db.prepare(`SELECT * FROM catalogs WHERE id = ?`).get(id);
  if (!catalog) return null;

  const parts = db.prepare(`
    SELECT * FROM parts
    WHERE catalog_id = ?
    ORDER BY page ASC, sort_index ASC, id ASC
  `).all(id);

  const hotspots = db.prepare(`
    SELECT * FROM hotspots
    WHERE catalog_id = ?
    ORDER BY page ASC, id ASC
  `).all(id);

  return { ...catalog, parts, hotspots };
}

function deleteCatalog(id) {
  db.prepare(`DELETE FROM catalogs WHERE id = ?`).run(id);
  return { ok: true };
}

function saveOrder(payload) {
  const {
    id,
    orderNumber,
    orderDate,
    requester,
    department,
    machineName,
    supplierEmail,
    generalNotes,
    status = 'draft',
    lines = []
  } = payload;

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, order_date, requester, department, machine_name, supplier_email, general_notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateOrder = db.prepare(`
    UPDATE orders
    SET order_number = ?, order_date = ?, requester = ?, department = ?, machine_name = ?, supplier_email = ?, general_notes = ?, status = ?
    WHERE id = ?
  `);

  const deleteLines = db.prepare(`DELETE FROM order_lines WHERE order_id = ?`);
  const insertLine = db.prepare(`
    INSERT INTO order_lines (order_id, part_id, pn, description, qty, urgency, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    let orderId = id;
    if (orderId) {
      updateOrder.run(
        orderNumber,
        orderDate,
        requester,
        department,
        machineName,
        supplierEmail,
        generalNotes,
        status,
        orderId
      );
      deleteLines.run(orderId);
    } else {
      orderId = insertOrder.run(
        orderNumber,
        orderDate,
        requester,
        department,
        machineName,
        supplierEmail,
        generalNotes,
        status
      ).lastInsertRowid;
    }

    lines.forEach((line) => {
      insertLine.run(
        orderId,
        Number(line.partId || 0) || null,
        String(line.pn || ''),
        String(line.description || ''),
        Number(line.qty || 1),
        String(line.urgency || 'רגיל'),
        String(line.notes || '')
      );
    });

    return Number(orderId);
  });

  return getOrder(tx());
}

function listOrders() {
  return db.prepare(`
    SELECT o.*,
           COUNT(ol.id) AS lines_count
    FROM orders o
    LEFT JOIN order_lines ol ON ol.order_id = o.id
    GROUP BY o.id
    ORDER BY o.id DESC
  `).all();
}

function getOrder(id) {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!order) return null;
  const lines = db.prepare(`SELECT * FROM order_lines WHERE order_id = ? ORDER BY id ASC`).all(id);
  return { ...order, lines };
}

function deleteOrder(id) {
  db.prepare(`DELETE FROM order_lines WHERE order_id = ?`).run(id);
  db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
  return { ok: true };
}

module.exports = {
  initDatabase,
  saveCatalog,
  listCatalogs,
  getCatalog,
  deleteCatalog,
  saveOrder,
  listOrders,
  getOrder,
  deleteOrder
};
