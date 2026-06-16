export const DEFAULT_CATEGORIES = [
  // Expense categories
  { name: 'خوراکی', icon: '🍞', type: 'expense' },
  { name: 'حمل‌ونقل', icon: '🚌', type: 'expense' },
  { name: 'قبوض', icon: '💡', type: 'expense' },
  { name: 'اجاره', icon: '🏠', type: 'expense' },
  { name: 'پوشاک', icon: '👕', type: 'expense' },
  { name: 'بهداشت', icon: '🧴', type: 'expense' },
  { name: 'تفریح', icon: '🎮', type: 'expense' },
  { name: 'تحصیل', icon: '📚', type: 'expense' },
  { name: 'هدیه', icon: '🎁', type: 'expense' },
  { name: 'سایر', icon: '📦', type: 'expense' },
  // Income categories
  { name: 'حقوق', icon: '💰', type: 'income' },
  { name: 'فریلنسری', icon: '💻', type: 'income' },
  { name: 'فروش', icon: '🛒', type: 'income' },
  { name: 'سایر درآمد', icon: '💵', type: 'income' },
];

export async function migrateDbIfNeeded(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_id INTEGER NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      UNIQUE(category_id, month, year)
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      notify_date TEXT,
      notification_id TEXT,
      notification_id_next TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT DEFAULT '',
      is_checked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_catalog_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(category_id, name)
    );
  `);

  try {
    await db.runAsync('ALTER TABLE shopping_lists ADD COLUMN notification_id_next TEXT');
  } catch (e) {
    // column already exists
  }

  const existing = await db.getFirstAsync('SELECT COUNT(*) as count FROM categories');
  if (existing.count === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (name, icon, type, is_default) VALUES (?, ?, ?, 1)',
        cat.name,
        cat.icon,
        cat.type
      );
    }
  }
}
