import { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { addTransaction, getCategories, addCategory } from '../database/queries';
import {
  getTodayJalali,
  getYearOptions,
  getMonthOptions,
  getDayOptions,
  getMonthName,
} from '../utils/date';
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

export default function AddTransactionScreen({ navigation }) {
  const db = useSQLiteContext();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const todayJ = getTodayJalali();
  const [selYear, setSelYear] = useState(todayJ.jy);
  const [selMonth, setSelMonth] = useState(todayJ.jm);
  const [selDay, setSelDay] = useState(todayJ.jd);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);

  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');

  const yearOptions = useMemo(() => getYearOptions(), []);
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const dayOptions = useMemo(() => getDayOptions(selYear, selMonth), [selYear, selMonth]);

  const dateString = `${selYear}/${String(selMonth).padStart(2, '0')}/${String(selDay).padStart(2, '0')}`;

  const loadCategories = useCallback(async () => {
    const cats = await getCategories(db, type);
    setCategories(cats);
    setSelectedCategory(null);
  }, [db, type]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('خطا', 'نام دسته‌بندی را وارد کنید');
      return;
    }
    await addCategory(db, { name: newCatName.trim(), icon: newCatIcon, type });
    setCatModalVisible(false);
    setNewCatName('');
    setNewCatIcon('📌');
    loadCategories();
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('خطا', 'لطفا مبلغ را وارد کنید');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('خطا', 'لطفا دسته‌بندی را انتخاب کنید');
      return;
    }

    await addTransaction(db, {
      amount: parseFloat(amount),
      categoryId: selectedCategory.id,
      description,
      date: dateString,
      type,
    });

    Alert.alert('موفق', type === 'expense' ? 'هزینه ثبت شد' : 'درآمد ثبت شد');
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    const today = getTodayJalali();
    setSelYear(today.jy);
    setSelMonth(today.jm);
    setSelDay(today.jd);
    navigation.navigate('داشبورد');
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Type Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, type === 'expense' && styles.toggleActive]}
          onPress={() => setType('expense')}
        >
          <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>
            هزینه
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, type === 'income' && styles.toggleActiveGreen]}
          onPress={() => setType('income')}
        >
          <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>
            درآمد
          </Text>
        </TouchableOpacity>
      </View>

      {/* Amount */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>مبلغ (تومان)</Text>
        <TextInput
          style={styles.input}
          placeholder="مثلاً ۵۰۰۰۰"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={COLORS.textLight}
        />
      </View>

      {/* Date Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>تاریخ (شمسی)</Text>
        <View style={styles.datePickerRow}>
          {/* Year */}
          <View style={styles.datePickerCol}>
            <Text style={styles.datePickerLabel}>سال</Text>
            <ScrollView style={styles.datePickerScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {yearOptions.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.datePickerItem, selYear === y && styles.datePickerItemActive]}
                  onPress={() => setSelYear(y)}
                >
                  <Text style={[styles.datePickerItemText, selYear === y && styles.datePickerItemTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {/* Month */}
          <View style={[styles.datePickerCol, { flex: 1.5 }]}>
            <Text style={styles.datePickerLabel}>ماه</Text>
            <ScrollView style={styles.datePickerScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {monthOptions.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.datePickerItem, selMonth === m.value && styles.datePickerItemActive]}
                  onPress={() => {
                    setSelMonth(m.value);
                    const maxDay = getDayOptions(selYear, m.value).length;
                    if (selDay > maxDay) setSelDay(maxDay);
                  }}
                >
                  <Text style={[styles.datePickerItemText, selMonth === m.value && styles.datePickerItemTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {/* Day */}
          <View style={styles.datePickerCol}>
            <Text style={styles.datePickerLabel}>روز</Text>
            <ScrollView style={styles.datePickerScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {dayOptions.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.datePickerItem, selDay === d && styles.datePickerItemActive]}
                  onPress={() => setSelDay(d)}
                >
                  <Text style={[styles.datePickerItemText, selDay === d && styles.datePickerItemTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <Text style={styles.datePreview}>{dateString}</Text>
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>توضیحات (اختیاری)</Text>
        <TextInput
          style={styles.input}
          placeholder="توضیح کوتاه..."
          value={description}
          onChangeText={setDescription}
          placeholderTextColor={COLORS.textLight}
        />
      </View>

      {/* Category picker */}
      <View style={styles.inputGroup}>
        <View style={styles.categoryHeader}>
          <Text style={styles.label}>دسته‌بندی</Text>
          <TouchableOpacity
            style={styles.addCatBtn}
            onPress={() => setCatModalVisible(true)}
          >
            <Text style={styles.addCatBtnText}>+ جدید</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory?.id === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory?.id === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          { backgroundColor: type === 'expense' ? COLORS.red : COLORS.green },
        ]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitText}>
          {type === 'expense' ? 'ثبت هزینه' : 'ثبت درآمد'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* Add Category Modal */}
      <Modal visible={catModalVisible} transparent animationType="slide" onRequestClose={() => setCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>دسته‌بندی جدید</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="نام دسته‌بندی"
              value={newCatName}
              onChangeText={setNewCatName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>آیکون انتخاب کنید:</Text>
            <ScrollView style={styles.iconScroll} nestedScrollEnabled>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      newCatIcon === icon && styles.iconOptionActive,
                    ]}
                    onPress={() => setNewCatIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddCategory}>
                <Text style={styles.modalSaveBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setCatModalVisible(false); setNewCatName(''); }}
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
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  toggleActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  toggleActiveGreen: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  toggleTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    textAlign: 'right',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  datePickerCol: {
    flex: 1,
    alignItems: 'center',
  },
  datePickerLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 6,
    fontWeight: '600',
  },
  datePickerScroll: {
    maxHeight: 120,
  },
  datePickerItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
    alignItems: 'center',
  },
  datePickerItemActive: {
    backgroundColor: COLORS.primary,
  },
  datePickerItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  datePickerItemTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  datePreview: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addCatBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addCatBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  categoryChipIcon: {
    fontSize: 18,
    marginLeft: 6,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.text,
  },
  categoryChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  iconScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  iconText: {
    fontSize: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
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
