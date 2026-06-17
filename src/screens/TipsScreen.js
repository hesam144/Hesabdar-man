import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { getSavingsTips, getMonthlySummary } from '../database/queries';
import { getCurrentMonth, formatCurrency, getPreviousMonth } from '../utils/date';
import { COLORS } from '../utils/colors';

const ALL_TIPS = [
  { icon: '📝', title: 'هزینه‌هات رو ثبت کن', body: 'هر خریدی که انجام می‌دی همون لحظه ثبت کن. این کار باعث می‌شه از خرج‌هات آگاه باشی.' },
  { icon: '🎯', title: 'بودجه تعیین کن', body: 'برای هر دسته‌بندی یه سقف ماهانه مشخص کن. وقتی نزدیک سقف شدی، هشدار می‌گیری.' },
  { icon: '🛒', title: 'لیست خرید بنویس', body: 'قبل از رفتن به فروشگاه لیست بنویس. خرید بدون لیست باعث خریدهای اضافی می‌شه.' },
  { icon: '☕', title: 'هزینه‌های کوچک رو جدی بگیر', body: 'یه قهوه ۵۰ هزار تومانی در روز = ۱.۵ میلیون در ماه! هزینه‌های کوچک جمع می‌شن.' },
  { icon: '📊', title: 'مقایسه ماهانه', body: 'هر ماه هزینه‌هات رو با ماه قبل مقایسه کن. توی بخش گزارش می‌تونی ببینی.' },
  { icon: '💰', title: 'قانون ۵۰/۳۰/۲۰', body: '۵۰٪ درآمد برای نیازها، ۳۰٪ برای خواسته‌ها، ۲۰٪ پس‌انداز. سعی کن این نسبت رو رعایت کنی.' },
  { icon: '⏳', title: 'قانون ۲۴ ساعت', body: 'قبل از هر خرید بزرگ، ۲۴ ساعت صبر کن. خیلی وقت‌ها بعد از فکر کردن منصرف می‌شی.' },
  { icon: '🏦', title: 'حساب پس‌انداز جدا', body: 'یه حساب مجزا برای پس‌انداز باز کن. اول ماه مبلغی رو خودکار انتقال بده.' },
  { icon: '🔄', title: 'اشتراک‌های بی‌استفاده رو حذف کن', body: 'سرویس‌های آنلاین و اشتراک‌هایی که استفاده نمی‌کنی رو لغو کن.' },
  { icon: '🍳', title: 'غذای خانگی بپز', body: 'رستوران رفتن حداقل ۳ برابر غذای خانگی هزینه داره. برنامه‌ریزی غذایی هفتگی داشته باش.' },
  { icon: '⚡', title: 'مصرف انرژی رو کاهش بده', body: 'خاموش کردن چراغ‌های اضافی و استفاده از لامپ کم‌مصرف تو قبض برق تأثیر داره.' },
  { icon: '🚌', title: 'حمل‌ونقل عمومی', body: 'به جای تاکسی و اسنپ، از مترو و اتوبوس استفاده کن. توی ماه خیلی صرفه‌جویی می‌شه.' },
  { icon: '🏷️', title: 'تخفیف‌ها رو دنبال کن', body: 'قبل از خرید، تخفیف و کد تخفیف بگرد. اپ‌های تخفیف رو نصب کن.' },
  { icon: '💪', title: 'چالش بدون خرج', body: 'هفته‌ای یه روز رو به «بدون خرج» اختصاص بده. فقط نیازهای ضروری.' },
  { icon: '📱', title: 'خریدهای آنلاین رو کنترل کن', body: 'سبد خرید اینترنتی رو ۲۴ ساعت نگه دار. خیلی وقت‌ها منصرف می‌شی.' },
  { icon: '🎁', title: 'هدیه خلاقانه بده', body: 'به جای هدیه‌های گرون، وقت و مهارتت رو هدیه بده. ارزشمندتره!' },
  { icon: '💡', title: 'قبض‌هات رو بررسی کن', body: 'هر ماه قبض‌ها رو چک کن. شاید سرویسی باشه که بی‌دلیل داری هزینه‌ش رو می‌دی.' },
  { icon: '🛍️', title: 'عمده بخر', body: 'کالاهای پرمصرف رو عمده بخر. هزینه هر واحد کمتر می‌شه.' },
  { icon: '🏠', title: 'تعمیر کن، نخر', body: 'قبل از خرید وسیله جدید، ببین آیا تعمیرش ممکنه یا نه.' },
  { icon: '📅', title: 'برنامه‌ریزی هفتگی', body: 'اول هفته برنامه مالی هفته رو بنویس. هزینه‌های غیرمنتظره کمتر می‌شن.' },
  { icon: '🥤', title: 'آب بخور!', body: 'به جای نوشیدنی‌های گرون، آب بخور. هم سالم‌تره هم ارزون‌تر.' },
  { icon: '👗', title: 'مد رو دنبال نکن', body: 'لباس‌های بی‌کیفیت و فصلی نخر. چند تا لباس باکیفیت بهتره.' },
  { icon: '🎮', title: 'سرگرمی رایگان', body: 'پارک رفتن، ورزش، کتابخانه و طبیعت‌گردی سرگرمی‌های رایگان هستن.' },
  { icon: '🧊', title: 'فریز کن', body: 'غذای اضافی رو فریز کن. هم دور ریز کمتر می‌شه هم وعده‌های بعدی آماده‌ست.' },
  { icon: '🤝', title: 'مشارکت کن', body: 'هزینه‌هایی مثل اشتراک نرم‌افزار یا بنزین رو با دوستان تقسیم کن.' },
  { icon: '📦', title: 'موجودی رو چک کن', body: 'قبل از خرید، ببین خونه چی داری. شاید چیزی که می‌خوای بخری داشته باشی.' },
  { icon: '🌱', title: 'سرمایه‌گذاری کوچیک', body: 'هر ماه حتی مبلغ کمی پس‌انداز کن. پول خودش پول می‌سازه.' },
  { icon: '📞', title: 'طرح مکالمه', body: 'طرح اینترنت و مکالمه‌ات رو بررسی کن. شاید طرح ارزون‌تری بهتر باشه.' },
  { icon: '🧮', title: 'قیمت هر واحد', body: 'موقع خرید قیمت هر کیلو/لیتر رو مقایسه کن، نه فقط قیمت بسته.' },
  { icon: '🔔', title: 'یادآور بودجه', body: 'هر هفته بودجه‌ات رو چک کن. زود متوجه خرج‌های اضافی می‌شی.' },
];

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function TipsScreen() {
  const db = useSQLiteContext();
  const [refreshing, setRefreshing] = useState(false);
  const [personalTips, setPersonalTips] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [displayedTips, setDisplayedTips] = useState(() => shuffleArray(ALL_TIPS).slice(0, 5));

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
      setComparison({ current: currentSummary.totalExpenses, previous: prevSummary.totalExpenses, diff, pct });
    } else {
      setComparison(null);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      setDisplayedTips(shuffleArray(ALL_TIPS).slice(0, 5));
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setDisplayedTips(shuffleArray(ALL_TIPS).slice(0, 5));
    setRefreshing(false);
  }, [loadData]);

  const handleShuffle = () => {
    setDisplayedTips(shuffleArray(ALL_TIPS).slice(0, 5));
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>💡 پیشنهاد صرفه‌جویی</Text>

      {/* Month comparison */}
      {comparison && (
        <View style={[styles.comparisonCard, { borderLeftColor: comparison.diff <= 0 ? COLORS.green : COLORS.red, borderLeftWidth: 4 }]}>
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
          <Text style={[styles.comparisonResult, { color: comparison.diff <= 0 ? COLORS.green : COLORS.red }]}>
            {comparison.diff <= 0
              ? `آفرین! ${Math.abs(comparison.pct)}٪ کمتر خرج کردی 🎉`
              : `${comparison.pct}٪ بیشتر از ماه قبل خرج کردی 📈`}
          </Text>
        </View>
      )}

      {/* Personal tips */}
      {personalTips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ هشدارهای شخصی</Text>
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

      {/* General tips - randomized */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>نکات صرفه‌جویی</Text>
          <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffle}>
            <Text style={styles.shuffleBtnText}>🔄 نکات جدید</Text>
          </TouchableOpacity>
        </View>
        {displayedTips.map((tip, i) => (
          <View key={`${tip.title}_${i}`} style={styles.generalTipCard}>
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
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginVertical: 16 },
  comparisonCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  comparisonTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 14, textAlign: 'right' },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  comparisonItem: { alignItems: 'center' },
  comparisonLabel: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  comparisonVal: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  comparisonResult: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  section: { marginBottom: 8 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'right' },
  shuffleBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.primary },
  shuffleBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  tipCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipIcon: { fontSize: 22, marginLeft: 10 },
  tipCategory: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  tipMessage: { fontSize: 14, color: COLORS.text, lineHeight: 24, textAlign: 'right' },
  tipCompare: { marginTop: 10, backgroundColor: COLORS.background, borderRadius: 10, padding: 10 },
  tipCompareText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },
  generalTipCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  generalTipIcon: { fontSize: 28, marginLeft: 14, marginTop: 2 },
  generalTipContent: { flex: 1 },
  generalTipTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6, textAlign: 'right' },
  generalTipBody: { fontSize: 13, color: COLORS.textLight, lineHeight: 22, textAlign: 'right' },
});
