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
import { getBudgets, setBudget, deleteBudget, getCategories, addCategory } from '../database/queries';
import { getCurrentMonth, formatCurrency, getMonthName } from '../utils/date';
import { COLORS } from '../utils/colors';

const ICON_OPTIONS = [
  '🍞', '🍕', '🍔', '🍎', '🥛', '☕', '🍰', '🥗',
  '🛍️', '🛒', '💰', '💵', '💳', '🏦', '💎', '🎁',
  '🚗', '🚌', '🚕', '🏍️', '✈️', '🚇', '⛽', '🚲',
  '🏠', '🏡', '🛋️', '🔑', '🧹', '🪴', '💡', '🚿',
  '🏥', '💊', '🧴', '💅', '🏋️', '🧘', '🩺', '😷',
  '📚', '🎓', '💻', '📱', '🖥️', '📝', '🖊️', '📐',
  '🎬', '🎮', '🎵', '🎭', '📷', '🎨', '⚽', '🎯',
  '👶', '👨‍👩‍👧', '🐱', '🐶', '🧸', '👕', '👗', '👟',
  '📌', '🔧', '📦', '🗓️', '🏢', '⭐', '❤️', '🌍',
];

export default function BudgetScreen() {
  const db = useSQLiteContext();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const { year, month } = getCurrentMonth();
  const monthName = getMonthName(month);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  const [newCatModalVisible, setNewCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');

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

  const handleOpenEdit = (b) => {
    setEditBudget(b);
    setEditAmount(String(b.amount));
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert('خطا', 'مبلغ معتبر وارد کنید');
      return;
    }
    await setBudget(db, {
      categoryId: editBudget.category_id,
      amount: parseFloat(editAmount),
      month,
      year,
    });
    setEditModalVisible(false);
    setEditBudget(null);
    loadData();
  };

  const handleDelete = (b) => {
    Alert.alert('حذف بودجه', `بودجه "${b.category_name}" حذف بشه؟`, [
      { text: 'نه', style: 'cancel' },
      {
        text: 'بله، حذف کن',
        style: 'destructive',
        onPress: async () => {
          await deleteBudget(db, b.id);
          loadData();
        },
      },
    ]);
  };

  const handleAddNewCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('خطا', 'نام دسته‌بندی را وارد کنید');
      return;
    }
    await addCategory(db, { name: newCatName.trim(), icon: newCatIcon, type: 'expense' });
    setNewCatModalVisible(false);
    setNewCatName('');
    setNewCatIcon('📌');
    loadData();
  };

  const getProgressColor = (spent, total) => {
    const pct = total > 0 ? spent / total : 0;
    if (pct >= 1) return COLORS.red;
    if (pct >= 0.8) return COLORS.orange;
    return COLORS.green;
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {/* Summary */}
        {budgets.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>خلاصه بودجه {monthName}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>کل بودجه</Text>
                <Text style={[styles.summaryVal, { color: COLORS.primary }]}>{formatCurrency(totalBudget)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>خرج شده</Text>
                <Text style={[styles.summaryVal, { color: totalSpent > totalBudget ? COLORS.red : COLORS.text }]}>{formatCurrency(totalSpent)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>مانده</Text>
                <Text style={[styles.summaryVal, { color: totalBudget - totalSpent >= 0 ? COLORS.green : COLORS.red }]}>{formatCurrency(totalBudget - totalSpent)}</Text>
              </View>
            </View>
          </View>
        )}

        {budgets.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💳</Text>
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
              onPress={() => handleOpenEdit(b)}
              onLongPress={() => handleDelete(b)}
            >
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetIcon}>{b.category_icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetName}>{b.category_name}</Text>
                  <Text style={styles.budgetHint}>لمس = ویرایش | نگه‌داشتن = حذف</Text>
                </View>
                <Text style={[styles.budgetPct, { color }]}>{pctNum}٪</Text>
              </View>

              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pctNum}%`, backgroundColor: color }]} />
              </View>

              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSpent}>خرج شده: {formatCurrency(b.spent)}</Text>
                <Text style={styles.budgetTotal}>بودجه: {formatCurrency(b.amount)}</Text>
              </View>

              {isOver && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>
                    ⚠️ بودجه رد شده! {formatCurrency(b.spent - b.amount)} اضافه خرج کردی
                  </Text>
                </View>
              )}

              {!isOver && pct >= 0.8 && (
                <View style={[styles.warningBadge, { backgroundColor: '#FFF8E1' }]}>
                  <Text style={[styles.warningText, { color: '#F57F17' }]}>
                    ⚠️ به سقف بودجه نزدیکی!
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Budget Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>تعیین بودجه {monthName}</Text>

            <Text style={styles.label}>دسته‌بندی</Text>
            <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={styles.catGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, selectedCategory?.id === cat.id && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={styles.catChipIcon}>{cat.icon}</Text>
                    <Text style={[styles.catChipText, selectedCategory?.id === cat.id && styles.catChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.addCatBtn}
              onPress={() => { setModalVisible(false); setNewCatModalVisible(true); }}
            >
              <Text style={styles.addCatBtnText}>+ دسته‌بندی جدید</Text>
            </TouchableOpacity>

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
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveBudget}>
                <Text style={styles.modalBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setModalVisible(false); setSelectedCategory(null); setBudgetAmount(''); }}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>ویرایش بودجه</Text>

            {editBudget && (
              <View style={styles.editInfo}>
                <Text style={styles.editInfoIcon}>{editBudget.category_icon}</Text>
                <Text style={styles.editInfoName}>{editBudget.category_name}</Text>
              </View>
            )}

            <Text style={styles.label}>سقف بودجه جدید (تومان)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalBtnText}>ذخیره</Text>
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

      {/* New Category Modal */}
      <Modal visible={newCatModalVisible} transparent animationType="slide" onRequestClose={() => setNewCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>دسته‌بندی جدید</Text>

            <Text style={styles.label}>نام دسته‌بندی</Text>
            <TextInput
              style={styles.input}
              placeholder="مثلاً سرگرمی"
              value={newCatName}
              onChangeText={setNewCatName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.label}>آیکون</Text>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, newCatIcon === icon && styles.iconOptionActive]}
                    onPress={() => setNewCatIcon(icon)}
                  >
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddNewCategory}>
                <Text style={styles.modalBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setNewCatModalVisible(false); setModalVisible(true); }}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  summaryCard: { backgroundColor: COLORS.primary, borderRadius: 18, padding: 18, marginBottom: 16, elevation: 3 },
  summaryTitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  summaryVal: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 40, alignItems: 'center', marginTop: 40, elevation: 2 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, color: COLORS.text, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  budgetCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  budgetIcon: { fontSize: 24, marginLeft: 10 },
  budgetName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  budgetHint: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  budgetPct: { fontSize: 18, fontWeight: 'bold' },
  progressBg: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetSpent: { fontSize: 13, color: COLORS.textLight },
  budgetTotal: { fontSize: 13, color: COLORS.textLight },
  warningBadge: { backgroundColor: '#FDEDED', borderRadius: 10, padding: 10, marginTop: 10, alignItems: 'center' },
  warningText: { fontSize: 13, color: COLORS.red, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 20, left: 20, width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, textAlign: 'right' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.border },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  catChipIcon: { fontSize: 16, marginLeft: 6 },
  catChipText: { fontSize: 13, color: COLORS.text },
  catChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  addCatBtn: { marginTop: 8, marginBottom: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  addCatBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: COLORS.background, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border, textAlign: 'right', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalSaveBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.primary, elevation: 2 },
  modalBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  modalCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border },
  modalCancelBtnText: { fontSize: 16, color: COLORS.textLight },
  editInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: 14, borderRadius: 14, marginBottom: 16 },
  editInfoIcon: { fontSize: 28, marginLeft: 10 },
  editInfoName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16, paddingVertical: 4 },
  iconOption: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border },
  iconOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, elevation: 2 },
});
