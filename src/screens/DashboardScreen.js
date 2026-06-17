import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  I18nManager,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMonthlySummary,
  getDailySummary,
  getExpensesByCategory,
  getTransactionsByMonth,
  deleteTransaction,
  updateTransaction,
  getCategories,
} from '../database/queries';
import {
  getTodayString,
  getTodayFullString,
  getCurrentMonth,
  formatCurrency,
  getMonthName,
  gregorianToJalali,
} from '../utils/date';
import { COLORS } from '../utils/colors';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [refreshing, setRefreshing] = useState(false);
  const [monthly, setMonthly] = useState({ totalExpenses: 0, totalIncome: 0, balance: 0 });
  const [daily, setDaily] = useState({ totalExpenses: 0 });
  const [topCategories, setTopCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { year, month } = getCurrentMonth();

  const loadData = useCallback(async () => {
    const today = getTodayString();
    const [m, d, cats, txns] = await Promise.all([
      getMonthlySummary(db, year, month),
      getDailySummary(db, today),
      getExpensesByCategory(db, year, month),
      getTransactionsByMonth(db, year, month),
    ]);
    setMonthly(m);
    setDaily(d);
    setTopCategories(cats.slice(0, 5));
    setTransactions(txns);
  }, [db, year, month]);

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

  const handleDeleteTx = (tx) => {
    Alert.alert(
      'حذف تراکنش',
      `"${tx.description || tx.category_name}" به مبلغ ${formatCurrency(tx.amount)} حذف بشه؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(db, tx.id);
            loadData();
          },
        },
      ]
    );
  };

  const handleEditTx = (tx) => {
    setEditTx(tx);
    setEditAmount(String(tx.amount));
    setEditDesc(tx.description || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert('خطا', 'مبلغ معتبر وارد کنید');
      return;
    }
    await updateTransaction(db, editTx.id, {
      amount: parseFloat(editAmount),
      categoryId: editTx.category_id,
      description: editDesc,
      date: gregorianToJalali(editTx.date),
      type: editTx.type,
    });
    setEditModalVisible(false);
    setEditTx(null);
    loadData();
  };

  const monthName = getMonthName(month);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Date Header */}
      <Text style={styles.dateHeader}>{getTodayFullString()}</Text>
      <Text style={styles.greeting}>حسابدار من</Text>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>موجودی {monthName}</Text>
        <Text
          style={[
            styles.balanceAmount,
            { color: monthly.balance >= 0 ? '#FFFFFF' : '#FFCDD2' },
          ]}
        >
          {formatCurrency(monthly.balance)}
        </Text>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.green }]}>
          <Text style={styles.summaryLabel}>درآمد {monthName}</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.green }]}>
            {formatCurrency(monthly.totalIncome)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.red }]}>
          <Text style={styles.summaryLabel}>هزینه {monthName}</Text>
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

      {/* Transactions List */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardTitleRow}
          onPress={() => setShowTransactions(!showTransactions)}
        >
          <Text style={styles.cardTitle}>تراکنش‌های {monthName}</Text>
          <Text style={styles.expandArrow}>{showTransactions ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showTransactions && transactions.length > 0 && transactions.map((tx) => (
          <TouchableOpacity
            key={tx.id}
            style={styles.txRow}
            onPress={() => handleEditTx(tx)}
            onLongPress={() => handleDeleteTx(tx)}
          >
            <Text style={styles.txIcon}>{tx.category_icon}</Text>
            <View style={styles.txInfo}>
              <Text style={styles.txName}>{tx.description || tx.category_name}</Text>
              <Text style={styles.txDate}>{gregorianToJalali(tx.date)}</Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.type === 'income' ? COLORS.green : COLORS.red }]}>
              {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
            </Text>
          </TouchableOpacity>
        ))}

        {showTransactions && transactions.length === 0 && (
          <Text style={styles.emptyText}>هنوز تراکنشی ثبت نشده</Text>
        )}

        {!showTransactions && (
          <Text style={styles.emptyText}>برای مشاهده لمس کنید</Text>
        )}
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

      {/* Edit Transaction Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>ویرایش تراکنش</Text>

            {editTx && (
              <View style={styles.txEditInfo}>
                <Text style={styles.txEditIcon}>{editTx.category_icon}</Text>
                <Text style={styles.txEditName}>{editTx.category_name}</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>مبلغ (تومان)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>توضیحات</Text>
            <TextInput
              style={styles.modalInput}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="توضیح کوتاه..."
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  dateHeader: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'left',
    marginTop: 12,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  balanceLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 30,
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
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  expandArrow: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 12,
  },
  todayAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txIcon: {
    fontSize: 22,
    marginLeft: 10,
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  txDate: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryIcon: {
    fontSize: 22,
    marginLeft: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.red,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D5DD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  txEditInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 12,
  },
  txEditIcon: {
    fontSize: 24,
    marginLeft: 8,
  },
  txEditName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    textAlign: 'right',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modalCancelBtnText: {
    color: COLORS.text,
    fontSize: 16,
  },
});
