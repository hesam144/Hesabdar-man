import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import {
  getMonthlySummary,
  getExpensesByCategory,
  getDailyExpensesForMonth,
} from '../database/queries';
import {
  getCurrentMonth,
  formatCurrency,
  formatNumber,
  getPreviousMonth,
  getNextMonth,
} from '../utils/date';
import { COLORS, CHART_COLORS } from '../utils/colors';

const screenWidth = Dimensions.get('window').width - 32;

const MONTH_NAMES = [
  '', 'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر',
];

export default function ReportScreen() {
  const db = useSQLiteContext();
  const [year, setYear] = useState(() => getCurrentMonth().year);
  const [month, setMonth] = useState(() => getCurrentMonth().month);
  const [summary, setSummary] = useState({ totalExpenses: 0, totalIncome: 0, balance: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  const loadData = useCallback(async () => {
    const [s, cats, daily] = await Promise.all([
      getMonthlySummary(db, year, month),
      getExpensesByCategory(db, year, month),
      getDailyExpensesForMonth(db, year, month),
    ]);
    setSummary(s);
    setCategoryData(cats);
    setDailyData(daily);
  }, [db, year, month]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const goPrev = () => {
    const p = getPreviousMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  };

  const goNext = () => {
    const n = getNextMonth(year, month);
    setYear(n.year);
    setMonth(n.month);
  };

  const pieData = categoryData.map((cat, i) => ({
    name: cat.name,
    amount: cat.total,
    color: CHART_COLORS[i % CHART_COLORS.length],
    legendFontColor: COLORS.text,
    legendFontSize: 12,
  }));

  const barLabels = dailyData.map((d) => d.date.split('-')[2]);
  const barValues = dailyData.map((d) => d.total);

  return (
    <ScrollView style={styles.container}>
      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goNext} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{'>'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>درآمد</Text>
          <Text style={[styles.summaryVal, { color: COLORS.green }]}>
            {formatCurrency(summary.totalIncome)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>هزینه</Text>
          <Text style={[styles.summaryVal, { color: COLORS.red }]}>
            {formatCurrency(summary.totalExpenses)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>تراز</Text>
          <Text
            style={[
              styles.summaryVal,
              { color: summary.balance >= 0 ? COLORS.green : COLORS.red },
            ]}
          >
            {formatCurrency(summary.balance)}
          </Text>
        </View>
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>سهم هر دسته‌بندی</Text>
          <PieChart
            data={pieData}
            width={screenWidth}
            height={200}
            chartConfig={{
              color: () => COLORS.primary,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      )}

      {/* Bar Chart - daily expenses */}
      {barLabels.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>هزینه روزانه</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{
                labels: barLabels,
                datasets: [{ data: barValues }],
              }}
              width={Math.max(screenWidth, barLabels.length * 40)}
              height={220}
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: COLORS.card,
                backgroundGradientFrom: COLORS.card,
                backgroundGradientTo: COLORS.card,
                decimalPlaces: 0,
                color: () => COLORS.primary,
                labelColor: () => COLORS.textLight,
                barPercentage: 0.6,
              }}
              style={{ borderRadius: 12 }}
            />
          </ScrollView>
        </View>
      )}

      {/* Category breakdown list */}
      {categoryData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>جزئیات هزینه‌ها</Text>
          {categoryData.map((cat, i) => {
            const pct =
              summary.totalExpenses > 0
                ? Math.round((cat.total / summary.totalExpenses) * 100)
                : 0;
            return (
              <View key={cat.id} style={styles.catRow}>
                <View
                  style={[
                    styles.catColor,
                    { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] },
                  ]}
                />
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catPct}>{pct}٪</Text>
                <Text style={styles.catAmount}>{formatCurrency(cat.total)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {categoryData.length === 0 && dailyData.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>هنوز تراکنشی ثبت نشده</Text>
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
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  navBtn: {
    padding: 10,
  },
  navBtnText: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  summaryVal: {
    fontSize: 13,
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
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  catColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  catIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  catName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  catPct: {
    fontSize: 13,
    color: COLORS.textLight,
    marginLeft: 8,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.red,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
});
