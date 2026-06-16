import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { addTransaction, getCategories, addCategory } from '../database/queries';
import { getTodayString } from '../utils/date';
import { COLORS } from '../utils/colors';

const ICON_OPTIONS = [
  '🍕', '🛍️', '🏥', '🎓', '🚗', '🏋️', '🎬', '💻',
  '🐱', '🏡', '✈️', '📱', '🎵', '💊', '🧹', '📌',
];

export default function AddTransactionScreen({ navigation }) {
  const db = useSQLiteContext();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);

  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');

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
      date,
      type,
    });

    Alert.alert('موفق', type === 'expense' ? 'هزینه ثبت شد' : 'درآمد ثبت شد');
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    navigation.navigate('داشبورد');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
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

        {/* Date (Shamsi) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>تاریخ (شمسی)</Text>
          <TextInput
            style={styles.input}
            placeholder="۱۴۰۴/۰۳/۲۵"
            value={date}
            onChangeText={setDate}
            placeholderTextColor={COLORS.textLight}
          />
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
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={catModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>دسته‌بندی جدید</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="نام دسته‌بندی"
              value={newCatName}
              onChangeText={setNewCatName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>آیکون انتخاب کنید:</Text>
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
    </KeyboardAvoidingView>
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
    paddingVertical: 12,
    borderRadius: 10,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'right',
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
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F0FE',
  },
  categoryChipIcon: {
    fontSize: 16,
    marginLeft: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: COLORS.text,
  },
  categoryChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
  },
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F0FE',
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
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelBtnText: {
    color: COLORS.text,
    fontSize: 16,
  },
});
