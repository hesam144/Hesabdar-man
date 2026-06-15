import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { getMonthlySummary, getDailySummary, getExpensesByCategory } from '../database/queries';
import { getTodayString, getCurrentMonth, formatCurrency } from '../utils/date';
import { COLORS } from '../utils/colors';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [refreshing, setRefreshing] = useState(false);
  const [monthly, setMonthly] = useState({ totalExpenses: 0, totalIncome: 0, balance: 0 });
  const [daily, setDaily] = useState({ totalExpenses: 0 });
  const [topCategories, setTopCategories] = useState([]);

  const loadData = useCallback(async () => {
    const { year, month } = getCurrentMonth();
    const today = getTodayString();
    const [m, d, cats] = await Promise.all([
      getMonthlySummary(db, year, month),
      getDailySummary(db, today),
      getExpensesByCategory(db, year, month),
    ]);
    setMonthly(m);
    setDaily(d);
    setTopCategories(cats.slice(0, 5));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>حسابدار من</Text>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>موجودی این ماه</Text>
        <Text
          style={[
            styles.balanceAmount,
            { color: monthly.balance >= 0 ? COLORS.green : COLORS.red },
          ]}
        >
          {formatCurrency(monthly.balance)}
        </Text>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.green }]}>
          <Text style={styles.summaryLabel}>درآمد ماهانه</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.green }]}>
            {formatCurrency(monthly.totalIncome)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.red }]}>
          <Text style={styles.summaryLabel}>هزینه ماهانه</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.red }]}>
            {formatCurrency(monthly.totalExpenses)}
          </Text>
        </View>
      </View>

      {/* Today's expenses */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>هزینه امروز</Text>
        <Text style={[styles.todayAmount, { color: COLORS.red }]}>
          {formatCurrency(daily.totalExpenses)}
        </Text>
      </View>

      {/* Top categories */}
      {topCategories.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>بیشترین هزینه‌ها</Text>
          {topCategories.map((cat) => (
            <View key={cat.id} style={styles.categoryRow}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={styles.categoryName}>{cat.name}</Text>
              <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  todayAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.red,
  },
});
