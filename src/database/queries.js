// --- Transactions ---

export async function addTransaction(db, { amount, categoryId, description, date, type }) {
  return db.runAsync(
    'INSERT INTO transactions (amount, category_id, description, date, type) VALUES (?, ?, ?, ?, ?)',
    amount,
    categoryId,
    description || '',
    date,
    type
  );
}

export async function deleteTransaction(db, id) {
  return db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function getTransactionsByDate(db, date) {
  return db.getAllAsync(
    `SELECT t.*, c.name as category_name, c.icon as category_icon
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.date = ?
     ORDER BY t.created_at DESC`,
    date
  );
}

export async function getTransactionsByMonth(db, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

export async function getMonthlySummary(db, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

export async function getDailySummary(db, date) {
  const expenses = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'expense' AND date = ?`,
    date
  );
  return { totalExpenses: expenses.total };
}

export async function getExpensesByCategory(db, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

export async function getDailyExpensesForMonth(db, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

export async function getBudgets(db, year, month) {
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
    `${year}-${String(month).padStart(2, '0')}-01`,
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`,
    month,
    year
  );
}

export async function deleteBudget(db, id) {
  return db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

// --- Savings tips ---

export async function getSavingsTips(db, year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const currentByCategory = await getExpensesByCategory(db, year, month);
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
