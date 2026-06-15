import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { getBudgets, setBudget, deleteBudget, getCategories } from '../database/queries';
import { getCurrentMonth, formatCurrency } from '../utils/date';
import { COLORS } from '../utils/colors';

export default function BudgetScreen() {
  const db = useSQLiteContext();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const { year, month } = getCurrentMonth();

  const loadData = useCallback(async () => {
    const [b, cats] = await Promise.all([
      getBudgets(db, year, month),
      getCategories(db, 'expense'),
    ]);
    setBudgets(b);
    setCategories(cats);
  }, [db, year, month]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveBudget = async () => {
    if (!selectedCategory || !budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('خطا', 'لطفا دسته‌بندی و مبلغ را وارد کنید');
      return;
    }
    await setBudget(db, {
      categoryId: selectedCategory.id,
      amount: parseFloat(budgetAmount),
      month,
      year,
    });
    setModalVisible(false);
    setSelectedCategory(null);
    setBudgetAmount('');
    loadData();
  };

  const handleDelete = (id) => {
    Alert.alert('حذف بودجه', 'مطمئنی می‌خوای حذفش کنی؟', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'بله',
        style: 'destructive',
        onPress: async () => {
          await deleteBudget(db, id);
          loadData();
        },
      },
    ]);
  };

  const getProgressColor = (spent, total) => {
    const pct = total > 0 ? spent / total : 0;
    if (pct >= 1) return COLORS.red;
    if (pct >= 0.8) return COLORS.orange;
    return COLORS.green;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.list}>
        {budgets.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>هنوز بودجه‌ای تنظیم نشده</Text>
            <Text style={styles.emptySubtext}>
              با دکمه + بودجه ماهانه برای هر دسته‌بندی تعیین کن
            </Text>
          </View>
        )}

        {budgets.map((b) => {
          const pct = b.amount > 0 ? Math.min(b.spent / b.amount, 1) : 0;
          const pctNum = Math.round(pct * 100);
          const color = getProgressColor(b.spent, b.amount);
          const isOver = b.spent > b.amount;

          return (
            <TouchableOpacity
              key={b.id}
              style={styles.budgetCard}
              onLongPress={() => handleDelete(b.id)}
            >
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetIcon}>{b.category_icon}</Text>
                <Text style={styles.budgetName}>{b.category_name}</Text>
                <Text style={[styles.budgetPct, { color }]}>{pctNum}٪</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[styles.progressFill, { width: `${pctNum}%`, backgroundColor: color }]}
                />
              </View>

              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSpent}>
                  خرج شده: {formatCurrency(b.spent)}
                </Text>
                <Text style={styles.budgetTotal}>
                  بودجه: {formatCurrency(b.amount)}
                </Text>
              </View>

              {isOver && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>
                    بودجه رد شده! {formatCurrency(b.spent - b.amount)} اضافه خرج کردی
                  </Text>
                </View>
              )}

              {!isOver && pct >= 0.8 && (
                <View style={[styles.warningBadge, { backgroundColor: '#FFF3CD' }]}>
                  <Text style={[styles.warningText, { color: '#856404' }]}>
                    به سقف بودجه نزدیکی!
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Budget Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعیین بودجه</Text>

            <Text style={styles.label}>دسته‌بندی</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    selectedCategory?.id === cat.id && styles.catChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={styles.catChipIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catChipText,
                      selectedCategory?.id === cat.id && styles.catChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>سقف بودجه (تومان)</Text>
            <TextInput
              style={styles.input}
              placeholder="مثلاً ۵۰۰۰۰۰"
              keyboardType="numeric"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveBudget}
              >
                <Text style={styles.modalBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.textLight }]}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedCategory(null);
                  setBudgetAmount('');
                }}
              >
                <Text style={styles.modalBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  budgetCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  budgetName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  budgetPct: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBg: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetSpent: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  budgetTotal: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  warningBadge: {
    backgroundColor: '#FDEDED',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 13,
    color: COLORS.red,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  catScroll: {
    marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F0FE',
  },
  catChipIcon: {
    fontSize: 16,
    marginLeft: 6,
  },
  catChipText: {
    fontSize: 13,
    color: COLORS.text,
  },
  catChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'right',
    marginBottom: 20,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
