import { getMonthDateRange, jalaliToGregorian } from '../utils/date';

// --- Transactions ---

export async function addTransaction(db, { amount, categoryId, description, date, type }) {
  const gDate = jalaliToGregorian(date) || date;
  return db.runAsync(
    'INSERT INTO transactions (amount, category_id, description, date, type) VALUES (?, ?, ?, ?, ?)',
    amount,
    categoryId,
    description || '',
    gDate,
    type
  );
}

export async function deleteTransaction(db, id) {
  return db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function getTransactionsByDate(db, jalaliDate) {
  const gDate = jalaliToGregorian(jalaliDate) || jalaliDate;
  return db.getAllAsync(
    `SELECT t.*, c.name as category_name, c.icon as category_icon
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.date = ?
     ORDER BY t.created_at DESC`,
    gDate
  );
}

export async function getTransactionsByMonth(db, jYear, jMonth) {
  const { startDate, endDate } = getMonthDateRange(jYear, jMonth);
  return db.getAllAsync(
    `SELECT t.*, c.name as category_name, c.icon as category_icon
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.date >= ? AND t.date < ?
     ORDER BY t.date DESC, t.created_at DESC`,
    startDate,
    endDate
  );
}

// --- Summaries ---

export async function getMonthlySummary(db, jYear, jMonth) {
  const { startDate, endDate } = getMonthDateRange(jYear, jMonth);

  const expenses = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'expense' AND date >= ? AND date < ?`,
    startDate,
    endDate
  );

  const income = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'income' AND date >= ? AND date < ?`,
    startDate,
    endDate
  );

  return {
    totalExpenses: expenses.total,
    totalIncome: income.total,
    balance: income.total - expenses.total,
  };
}

export async function getDailySummary(db, jalaliDate) {
  const gDate = jalaliToGregorian(jalaliDate) || jalaliDate;
  const expenses = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'expense' AND date = ?`,
    gDate
  );
  return { totalExpenses: expenses.total };
}

export async function getExpensesByCategory(db, jYear, jMonth) {
  const { startDate, endDate } = getMonthDateRange(jYear, jMonth);
  return db.getAllAsync(
    `SELECT c.id, c.name, c.icon, COALESCE(SUM(t.amount), 0) as total
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id
       AND t.date >= ? AND t.date < ? AND t.type = 'expense'
     WHERE c.type = 'expense'
     GROUP BY c.id
     HAVING total > 0
     ORDER BY total DESC`,
    startDate,
    endDate
  );
}

export async function getDailyExpensesForMonth(db, jYear, jMonth) {
  const { startDate, endDate } = getMonthDateRange(jYear, jMonth);
  return db.getAllAsync(
    `SELECT date, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND date >= ? AND date < ?
     GROUP BY date
     ORDER BY date`,
    startDate,
    endDate
  );
}

// --- Categories ---

export async function getCategories(db, type) {
  if (type) {
    return db.getAllAsync('SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, name', type);
  }
  return db.getAllAsync('SELECT * FROM categories ORDER BY type, is_default DESC, name');
}

export async function addCategory(db, { name, icon, type }) {
  return db.runAsync(
    'INSERT INTO categories (name, icon, type, is_default) VALUES (?, ?, ?, 0)',
    name,
    icon,
    type
  );
}

// --- Budgets ---

export async function setBudget(db, { categoryId, amount, month, year }) {
  return db.runAsync(
    `INSERT INTO budgets (category_id, amount, month, year)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(category_id, month, year)
     DO UPDATE SET amount = excluded.amount`,
    categoryId,
    amount,
    month,
    year
  );
}

export async function getBudgets(db, jYear, jMonth) {
  const { startDate, endDate } = getMonthDateRange(jYear, jMonth);
  return db.getAllAsync(
    `SELECT b.*, c.name as category_name, c.icon as category_icon,
            COALESCE((
              SELECT SUM(t.amount)
              FROM transactions t
              WHERE t.category_id = b.category_id
                AND t.type = 'expense'
                AND t.date >= ? AND t.date < ?
            ), 0) as spent
     FROM budgets b
     JOIN categories c ON b.category_id = c.id
     WHERE b.month = ? AND b.year = ?
     ORDER BY c.name`,
    startDate,
    endDate,
    jMonth,
    jYear
  );
}

export async function deleteBudget(db, id) {
  return db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

// --- Savings tips ---

export async function getSavingsTips(db, jYear, jMonth) {
  const prevMonth = jMonth === 1 ? 12 : jMonth - 1;
  const prevYear = jMonth === 1 ? jYear - 1 : jYear;

  const currentByCategory = await getExpensesByCategory(db, jYear, jMonth);
  const previousByCategory = await getExpensesByCategory(db, prevYear, prevMonth);

  const prevMap = {};
  for (const row of previousByCategory) {
    prevMap[row.id] = row.total;
  }

  const tips = [];
  for (const cat of currentByCategory) {
    const prev = prevMap[cat.id] || 0;
    if (prev > 0 && cat.total > prev) {
      const increase = Math.round(((cat.total - prev) / prev) * 100);
      if (increase >= 20) {
        tips.push({
          category: cat.name,
          icon: cat.icon,
          currentTotal: cat.total,
          previousTotal: prev,
          increasePercent: increase,
          message: `هزینه ${cat.name} ${increase}٪ بیشتر از ماه قبله. سعی کن کمترش کنی!`,
        });
      }
    }
  }

  return tips.sort((a, b) => b.increasePercent - a.increasePercent);
}

// --- Shopping Lists ---

export async function createShoppingList(db, { name, date, notifyDate, notificationId, notificationIdNext }) {
  const gDate = jalaliToGregorian(date) || date;
  const gNotifyDate = notifyDate ? (jalaliToGregorian(notifyDate) || notifyDate) : null;
  return db.runAsync(
    'INSERT INTO shopping_lists (name, date, notify_date, notification_id, notification_id_next) VALUES (?, ?, ?, ?, ?)',
    name,
    gDate,
    gNotifyDate,
    notificationId || null,
    notificationIdNext || null
  );
}

export async function getShoppingLists(db) {
  return db.getAllAsync(
    `SELECT sl.*,
            (SELECT COUNT(*) FROM shopping_items si WHERE si.list_id = sl.id) as total_items,
            (SELECT COUNT(*) FROM shopping_items si WHERE si.list_id = sl.id AND si.is_checked = 1) as checked_items
     FROM shopping_lists sl
     ORDER BY sl.is_completed ASC, sl.date DESC, sl.created_at DESC`
  );
}

export async function getShoppingListById(db, id) {
  return db.getFirstAsync('SELECT * FROM shopping_lists WHERE id = ?', id);
}

export async function deleteShoppingList(db, id) {
  await db.runAsync('DELETE FROM shopping_items WHERE list_id = ?', id);
  return db.runAsync('DELETE FROM shopping_lists WHERE id = ?', id);
}

export async function toggleShoppingListComplete(db, id, isCompleted) {
  return db.runAsync('UPDATE shopping_lists SET is_completed = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function markShoppingListPurchased(db, id) {
  return db.runAsync('UPDATE shopping_lists SET is_purchased = 1 WHERE id = ?', id);
}

export async function updateShoppingListNotification(db, id, notifyDate, notificationId, notificationIdNext) {
  const gNotifyDate = notifyDate ? (jalaliToGregorian(notifyDate) || notifyDate) : null;
  return db.runAsync(
    'UPDATE shopping_lists SET notify_date = ?, notification_id = ?, notification_id_next = ? WHERE id = ?',
    gNotifyDate,
    notificationId || null,
    notificationIdNext || null,
    id
  );
}

export async function updateShoppingList(db, id, { name, date, notifyDate, notificationId, notificationIdNext }) {
  const gDate = jalaliToGregorian(date) || date;
  const gNotifyDate = notifyDate ? (jalaliToGregorian(notifyDate) || notifyDate) : null;
  return db.runAsync(
    'UPDATE shopping_lists SET name = ?, date = ?, notify_date = ?, notification_id = ?, notification_id_next = ? WHERE id = ?',
    name,
    gDate,
    gNotifyDate,
    notificationId || null,
    notificationIdNext || null,
    id
  );
}

// --- Shopping Items ---

export async function addShoppingItem(db, { listId, name, quantity }) {
  return db.runAsync(
    'INSERT INTO shopping_items (list_id, name, quantity) VALUES (?, ?, ?)',
    listId,
    name,
    quantity || ''
  );
}

export async function getShoppingItems(db, listId) {
  return db.getAllAsync(
    'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY is_checked ASC, id ASC',
    listId
  );
}

export async function toggleShoppingItem(db, id, isChecked) {
  return db.runAsync('UPDATE shopping_items SET is_checked = ? WHERE id = ?', isChecked ? 1 : 0, id);
}

export async function deleteShoppingItem(db, id) {
  return db.runAsync('DELETE FROM shopping_items WHERE id = ?', id);
}

// --- Custom Catalog Items ---

export async function getCustomCatalogItems(db) {
  return db.getAllAsync('SELECT * FROM custom_catalog_items ORDER BY category_id, name');
}

export async function addCustomCatalogItem(db, categoryId, name) {
  return db.runAsync(
    'INSERT OR IGNORE INTO custom_catalog_items (category_id, name) VALUES (?, ?)',
    categoryId,
    name
  );
}
