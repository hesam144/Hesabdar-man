import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { getSavingsTips, getMonthlySummary } from '../database/queries';
import { getCurrentMonth, formatCurrency, getPreviousMonth } from '../utils/date';
import { COLORS } from '../utils/colors';

const GENERAL_TIPS = [
  {
    icon: '📝',
    title: 'هزینه‌هات رو ثبت کن',
    body: 'هر خریدی که انجام می‌دی همون لحظه ثبت کن. این کار باعث می‌شه از خرج‌هات آگاه باشی.',
  },
  {
    icon: '🎯',
    title: 'بودجه تعیین کن',
    body: 'برای هر دسته‌بندی یه سقف ماهانه مشخص کن. وقتی نزدیک سقف شدی، هشدار می‌گیری.',
  },
  {
    icon: '🛒',
    title: 'لیست خرید بنویس',
    body: 'قبل از رفتن به فروشگاه لیست بنویس. خرید بدون لیست باعث خریدهای اضافی می‌شه.',
  },
  {
    icon: '☕',
    title: 'هزینه‌های کوچک رو جدی بگیر',
    body: 'یه قهوه ۵۰ هزار تومانی در روز = ۱.۵ میلیون در ماه! هزینه‌های کوچک جمع می‌شن.',
  },
  {
    icon: '📊',
    title: 'مقایسه ماهانه',
    body: 'هر ماه هزینه‌هات رو با ماه قبل مقایسه کن. توی بخش گزارش می‌تونی ببینی.',
  },
  {
    icon: '💰',
    title: 'قانون ۵۰/۳۰/۲۰',
    body: '۵۰٪ درآمد برای نیازها، ۳۰٪ برای خواسته‌ها، ۲۰٪ پس‌انداز. سعی کن این نسبت رو رعایت کنی.',
  },
  {
    icon: '⏳',
    title: 'قانون ۲۴ ساعت',
    body: 'قبل از هر خرید بزرگ، ۲۴ ساعت صبر کن. خیلی وقت‌ها بعد از فکر کردن منصرف می‌شی.',
  },
];

export default function TipsScreen() {
  const db = useSQLiteContext();
  const [refreshing, setRefreshing] = useState(false);
  const [personalTips, setPersonalTips] = useState([]);
  const [comparison, setComparison] = useState(null);

  const loadData = useCallback(async () => {
    const { year, month } = getCurrentMonth();
    const prev = getPreviousMonth(year, month);

    const [tips, currentSummary, prevSummary] = await Promise.all([
      getSavingsTips(db, year, month),
      getMonthlySummary(db, year, month),
      getMonthlySummary(db, prev.year, prev.month),
    ]);

    setPersonalTips(tips);

    if (prevSummary.totalExpenses > 0) {
      const diff = currentSummary.totalExpenses - prevSummary.totalExpenses;
      const pct = Math.round((diff / prevSummary.totalExpenses) * 100);
      setComparison({
        current: currentSummary.totalExpenses,
        previous: prevSummary.totalExpenses,
        diff,
        pct,
      });
    } else {
      setComparison(null);
    }
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
      <Text style={styles.title}>پیشنهاد صرفه‌جویی</Text>

      {/* Month comparison */}
      {comparison && (
        <View
          style={[
            styles.comparisonCard,
            {
              borderLeftColor: comparison.diff <= 0 ? COLORS.green : COLORS.red,
              borderLeftWidth: 4,
            },
          ]}
        >
          <Text style={styles.comparisonTitle}>مقایسه با ماه قبل</Text>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>ماه قبل</Text>
              <Text style={styles.comparisonVal}>{formatCurrency(comparison.previous)}</Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>این ماه</Text>
              <Text style={styles.comparisonVal}>{formatCurrency(comparison.current)}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.comparisonResult,
              { color: comparison.diff <= 0 ? COLORS.green : COLORS.red },
            ]}
          >
            {comparison.diff <= 0
              ? `آفرین! ${Math.abs(comparison.pct)}٪ کمتر خرج کردی`
              : `${comparison.pct}٪ بیشتر از ماه قبل خرج کردی`}
          </Text>
        </View>
      )}

      {/* Personal tips based on spending patterns */}
      {personalTips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>هشدارهای شخصی</Text>
          {personalTips.map((tip, i) => (
            <View key={i} style={[styles.tipCard, { borderLeftColor: COLORS.orange, borderLeftWidth: 4 }]}>
              <View style={styles.tipHeader}>
                <Text style={styles.tipIcon}>{tip.icon}</Text>
                <Text style={styles.tipCategory}>{tip.category}</Text>
              </View>
              <Text style={styles.tipMessage}>{tip.message}</Text>
              <View style={styles.tipCompare}>
                <Text style={styles.tipCompareText}>
                  ماه قبل: {formatCurrency(tip.previousTotal)} → این ماه: {formatCurrency(tip.currentTotal)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* General tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>نکات کلی صرفه‌جویی</Text>
        {GENERAL_TIPS.map((tip, i) => (
          <View key={i} style={styles.generalTipCard}>
            <Text style={styles.generalTipIcon}>{tip.icon}</Text>
            <View style={styles.generalTipContent}>
              <Text style={styles.generalTipTitle}>{tip.title}</Text>
              <Text style={styles.generalTipBody}>{tip.body}</Text>
            </View>
          </View>
        ))}
      </View>

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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: 16,
  },
  comparisonCard: {
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
  comparisonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  comparisonVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  comparisonResult: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  tipCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  tipCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  tipMessage: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  tipCompare: {
    marginTop: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
  },
  tipCompareText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  generalTipCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    elevation: 1,
  },
  generalTipIcon: {
    fontSize: 24,
    marginLeft: 12,
    marginTop: 2,
  },
  generalTipContent: {
    flex: 1,
  },
  generalTipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  generalTipBody: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
    textAlign: 'right',
  },
});
