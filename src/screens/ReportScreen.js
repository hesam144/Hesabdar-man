import { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Animated, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  getMonthlySummary,
  getExpensesByCategory,
  getDailyExpensesForMonth,
  getTransactionsByMonth,
} from '../database/queries';
import {
  getCurrentMonth,
  formatCurrency,
  formatNumber,
  getPreviousMonth,
  getNextMonth,
  getMonthName,
  gregorianToJalali,
} from '../utils/date';
import { COLORS, CHART_COLORS } from '../utils/colors';

const screenWidth = Dimensions.get('window').width - 32;

export default function ReportScreen() {
  const db = useSQLiteContext();
  const [year, setYear] = useState(() => getCurrentMonth().year);
  const [month, setMonth] = useState(() => getCurrentMonth().month);
  const [summary, setSummary] = useState({ totalExpenses: 0, totalIncome: 0, balance: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const animValue = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    const [s, cats, daily] = await Promise.all([
      getMonthlySummary(db, year, month),
      getExpensesByCategory(db, year, month),
      getDailyExpensesForMonth(db, year, month),
    ]);
    setSummary(s);
    setCategoryData(cats);
    setDailyData(daily);

    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
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

  const handleExportCSV = async () => {
    try {
      const txns = await getTransactionsByMonth(db, year, month);
      if (txns.length === 0) {
        Alert.alert('خالی', 'تراکنشی برای این ماه ثبت نشده');
        return;
      }

      const header = 'تاریخ,نوع,دسته‌بندی,توضیحات,مبلغ\n';
      const rows = txns.map((tx) => {
        const date = gregorianToJalali(tx.date);
        const type = tx.type === 'expense' ? 'هزینه' : 'درآمد';
        const desc = (tx.description || '').replace(/,/g, '،');
        return `${date},${type},${tx.category_name},${desc},${tx.amount}`;
      }).join('\n');

      const csv = '\uFEFF' + header + rows;
      const monthName = getMonthName(month);
      const fileName = `گزارش_${monthName}_${year}.csv`;
      const filePath = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: `خروجی گزارش ${monthName} ${year}`,
        });
      } else {
        Alert.alert('موفق', 'فایل ذخیره شد');
      }
    } catch (e) {
      console.log('CSV export error:', e);
      Alert.alert('خطا', 'مشکلی در خروجی گرفتن پیش آمد');
    }
  };

  const pieData = categoryData.map((cat, i) => {
    const pct = summary.totalExpenses > 0 ? Math.round((cat.total / summary.totalExpenses) * 100) : 0;
    return {
      name: `${cat.name} ${pct}٪`,
      amount: cat.total,
      color: CHART_COLORS[i % CHART_COLORS.length],
      legendFontColor: COLORS.text,
      legendFontSize: 11,
    };
  });

  const barLabels = dailyData.map((d) => {
    const jDate = gregorianToJalali(d.date);
    return jDate.split('/')[2];
  });
  const barValues = dailyData.map((d) => d.total);

  return (
    <ScrollView style={styles.container}>
      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goNext} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{'>'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {getMonthName(month)} {year}
        </Text>
        <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
          <Text style={styles.navBtnText}>{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryItem, { borderTopColor: COLORS.green, borderTopWidth: 3 }]}>
          <Text style={styles.summaryLabel}>درآمد</Text>
          <Text style={[styles.summaryVal, { color: COLORS.green }]}>{formatCurrency(summary.totalIncome)}</Text>
        </View>
        <View style={[styles.summaryItem, { borderTopColor: COLORS.red, borderTopWidth: 3 }]}>
          <Text style={styles.summaryLabel}>هزینه</Text>
          <Text style={[styles.summaryVal, { color: COLORS.red }]}>{formatCurrency(summary.totalExpenses)}</Text>
        </View>
        <View style={[styles.summaryItem, { borderTopColor: COLORS.primary, borderTopWidth: 3 }]}>
          <Text style={styles.summaryLabel}>تراز</Text>
          <Text style={[styles.summaryVal, { color: summary.balance >= 0 ? COLORS.green : COLORS.red }]}>
            {formatCurrency(summary.balance)}
          </Text>
        </View>
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Animated.View style={[styles.card, { opacity: animValue, transform: [{ scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
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
            paddingLeft="0"
            absolute={false}
          />
        </Animated.View>
      )}

      {/* Category breakdown list with percentages */}
      {categoryData.length > 0 && (
        <Animated.View style={[styles.card, { opacity: animValue }]}>
          <Text style={styles.cardTitle}>جزئیات هزینه‌ها</Text>
          {categoryData.map((cat, i) => {
            const pct = summary.totalExpenses > 0 ? Math.round((cat.total / summary.totalExpenses) * 100) : 0;
            return (
              <View key={cat.id} style={styles.catRow}>
                <View style={[styles.catColor, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={styles.catName}>{cat.name}</Text>
                <View style={styles.catPctBadge}>
                  <Text style={styles.catPct}>{pct}٪</Text>
                </View>
                <Text style={styles.catAmount}>{formatCurrency(cat.total)}</Text>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Bar Chart - daily expenses */}
      {barLabels.length > 0 && (
        <Animated.View style={[styles.card, { opacity: animValue }]}>
          <Text style={styles.cardTitle}>هزینه روزانه</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{
                labels: barLabels,
                datasets: [{ data: barValues.length > 0 ? barValues : [0] }],
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
        </Animated.View>
      )}

      {/* CSV Export */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
        <Text style={styles.exportBtnText}>📥 خروجی CSV گزارش {getMonthName(month)}</Text>
      </TouchableOpacity>

      {categoryData.length === 0 && dailyData.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>هنوز تراکنشی ثبت نشده</Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  navBtn: { backgroundColor: COLORS.card, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  navBtnText: { fontSize: 20, color: COLORS.primary, fontWeight: 'bold' },
  monthTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  summaryLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 6 },
  summaryVal: { fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, marginBottom: 16, elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, marginBottom: 14, textAlign: 'right' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  catColor: { width: 12, height: 12, borderRadius: 6, marginLeft: 8 },
  catIcon: { fontSize: 18, marginLeft: 8 },
  catName: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  catPctBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  catPct: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  catAmount: { fontSize: 13, fontWeight: '600', color: COLORS.red },
  exportBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16, elevation: 2, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  exportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 40, alignItems: 'center', marginTop: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textLight },
});
