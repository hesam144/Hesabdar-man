import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  getShoppingLists,
  createShoppingList,
  deleteShoppingList,
  toggleShoppingListComplete,
  addShoppingItem,
  getShoppingItems,
  toggleShoppingItem,
  deleteShoppingItem,
} from '../database/queries';
import {
  getTodayString,
  gregorianToJalali,
  jalaliToDate,
} from '../utils/date';
import { COLORS } from '../utils/colors';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function ShoppingListScreen() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [listDate, setListDate] = useState(getTodayString());
  const [listNotifyDate, setListNotifyDate] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission not granted');
      }
    })();
  }, []);

  const loadLists = useCallback(async () => {
    const data = await getShoppingLists(db);
    setLists(data);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists])
  );

  const loadItems = useCallback(async (listId) => {
    const items = await getShoppingItems(db, listId);
    setExpandedItems(items);
  }, [db]);

  const handleExpand = async (listId) => {
    if (expandedId === listId) {
      setExpandedId(null);
      setExpandedItems([]);
      return;
    }
    setExpandedId(listId);
    await loadItems(listId);
  };

  const handleCreateList = async () => {
    if (!listName.trim()) {
      Alert.alert('خطا', 'نام لیست را وارد کنید');
      return;
    }

    let notificationId = null;
    if (listNotifyDate.trim()) {
      const notifyDateObj = jalaliToDate(listNotifyDate);
      if (notifyDateObj && notifyDateObj > new Date()) {
        notifyDateObj.setHours(9, 0, 0, 0);
        try {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'یادآوری لیست خرید 🛒',
              body: `امروز باید "${listName.trim()}" رو خرید کنی!`,
            },
            trigger: { date: notifyDateObj },
          });
        } catch (e) {
          console.log('Failed to schedule notification:', e);
        }
      }
    }

    await createShoppingList(db, {
      name: listName.trim(),
      date: listDate,
      notifyDate: listNotifyDate.trim() || null,
      notificationId,
    });

    setCreateModalVisible(false);
    setListName('');
    setListDate(getTodayString());
    setListNotifyDate('');
    loadLists();
  };

  const handleDeleteList = (list) => {
    Alert.alert('حذف لیست', `لیست "${list.name}" حذف بشه؟`, [
      { text: 'نه', style: 'cancel' },
      {
        text: 'بله، حذف کن',
        style: 'destructive',
        onPress: async () => {
          if (list.notification_id) {
            try {
              await Notifications.cancelScheduledNotificationAsync(list.notification_id);
            } catch (e) {
              console.log('Failed to cancel notification:', e);
            }
          }
          await deleteShoppingList(db, list.id);
          if (expandedId === list.id) {
            setExpandedId(null);
            setExpandedItems([]);
          }
          loadLists();
        },
      },
    ]);
  };

  const handleToggleComplete = async (list) => {
    await toggleShoppingListComplete(db, list.id, !list.is_completed);
    loadLists();
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !expandedId) return;
    await addShoppingItem(db, {
      listId: expandedId,
      name: newItemName.trim(),
      quantity: newItemQty.trim(),
    });
    setNewItemName('');
    setNewItemQty('');
    await loadItems(expandedId);
    loadLists();
  };

  const handleToggleItem = async (item) => {
    await toggleShoppingItem(db, item.id, !item.is_checked);
    await loadItems(expandedId);
    loadLists();
  };

  const handleDeleteItem = async (item) => {
    await deleteShoppingItem(db, item.id);
    await loadItems(expandedId);
    loadLists();
  };

  const handleShareList = async (list) => {
    const items = await getShoppingItems(db, list.id);
    const checked = items.filter((i) => i.is_checked).length;
    const total = items.length;

    const itemLines = items.map((i) => {
      const check = i.is_checked ? '  ✅' : '  🔲';
      const qty = i.quantity ? `  ×${i.quantity}` : '';
      return `${check}  ${i.name}${qty}`;
    });

    const text = [
      '🛒 ─────────────────',
      `   ${list.name}`,
      '─────────────────────',
      `📅  ${gregorianToJalali(list.date)}`,
      `📊  ${checked} از ${total} آیتم خریداری شده`,
      '',
      ...itemLines,
      '',
      '─────────────────────',
      '📱 حسابدار من',
    ].join('\n');

    try {
      await Share.share({ message: text });
    } catch (e) {
      console.log('Share failed:', e);
    }
  };

  const getProgressPercent = (list) => {
    if (!list.total_items || list.total_items === 0) return 0;
    return Math.round((list.checked_items / list.total_items) * 100);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.list}>
        {lists.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>هنوز لیست خریدی نداری</Text>
            <Text style={styles.emptySubtext}>
              با دکمه + لیست خرید جدید بساز
            </Text>
          </View>
        )}

        {lists.map((list) => {
          const progress = getProgressPercent(list);
          const isExpanded = expandedId === list.id;

          return (
            <View key={list.id} style={styles.listWrapper}>
              <TouchableOpacity
                style={[
                  styles.listCard,
                  list.is_completed && styles.listCardCompleted,
                  isExpanded && styles.listCardExpanded,
                ]}
                onPress={() => handleExpand(list.id)}
                activeOpacity={0.7}
              >
                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: progress === 100 ? COLORS.green : COLORS.primary,
                      },
                    ]}
                  />
                </View>

                <View style={styles.listHeader}>
                  <TouchableOpacity
                    onPress={() => handleToggleComplete(list)}
                    style={styles.checkBtn}
                  >
                    <View style={[
                      styles.checkbox,
                      list.is_completed && styles.checkboxChecked,
                    ]}>
                      {list.is_completed && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.listInfo}>
                    <Text style={[
                      styles.listName,
                      list.is_completed && styles.listNameCompleted,
                    ]}>
                      {list.name}
                    </Text>
                    <View style={styles.listMeta}>
                      <Text style={styles.listDate}>
                        📅 {gregorianToJalali(list.date)}
                      </Text>
                      {list.notify_date && (
                        <Text style={styles.listNotify}>
                          🔔 {gregorianToJalali(list.notify_date)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.listActions}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {list.checked_items}/{list.total_items}
                      </Text>
                    </View>
                    <View style={styles.actionBtns}>
                      <TouchableOpacity
                        onPress={() => handleShareList(list)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>📤</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteList(list)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.expandHint}>
                  <Text style={styles.expandHintText}>
                    {isExpanded ? '▲ بستن' : '▼ مشاهده آیتم‌ها'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.itemsContainer}>
                  {expandedItems.length === 0 && (
                    <Text style={styles.noItemsText}>هنوز آیتمی اضافه نشده</Text>
                  )}

                  {expandedItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <TouchableOpacity
                        onPress={() => handleToggleItem(item)}
                        style={styles.itemCheckBtn}
                      >
                        <View style={[
                          styles.itemCheckbox,
                          item.is_checked && styles.itemCheckboxChecked,
                        ]}>
                          {item.is_checked && <Text style={styles.itemCheckMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                      <Text style={[
                        styles.itemName,
                        item.is_checked && styles.itemNameChecked,
                      ]}>
                        {item.name}
                      </Text>
                      {item.quantity ? (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyText}>×{item.quantity}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => handleDeleteItem(item)}
                        style={styles.itemDeleteBtn}
                      >
                        <Text style={styles.itemDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.addItemRow}>
                    <TextInput
                      style={styles.addItemInput}
                      placeholder="نام آیتم..."
                      value={newItemName}
                      onChangeText={setNewItemName}
                      placeholderTextColor={COLORS.textLight}
                    />
                    <TextInput
                      style={styles.addItemQtyInput}
                      placeholder="تعداد"
                      value={newItemQty}
                      onChangeText={setNewItemQty}
                      placeholderTextColor={COLORS.textLight}
                    />
                    <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                      <Text style={styles.addItemBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create List Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🛒</Text>
              <Text style={styles.modalTitle}>لیست خرید جدید</Text>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="نام لیست (مثلاً خرید هفتگی)"
              value={listName}
              onChangeText={setListName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>📅 تاریخ خرید (شمسی)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۵/۰۳/۲۵"
              value={listDate}
              onChangeText={setListDate}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>🔔 تاریخ یادآوری (اختیاری)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۵/۰۳/۲۴"
              value={listNotifyDate}
              onChangeText={setListNotifyDate}
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleCreateList}>
                <Text style={styles.modalSaveBtnText}>ساخت لیست</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setCreateModalVisible(false); setListName(''); }}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  listWrapper: {
    marginBottom: 12,
  },
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listCardCompleted: {
    opacity: 0.65,
  },
  listCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  checkBtn: {
    padding: 4,
    marginLeft: 10,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  checkboxChecked: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listInfo: {
    flex: 1,
    marginRight: 4,
  },
  listName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
  },
  listNameCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  listMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  listDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  listNotify: {
    fontSize: 12,
    color: COLORS.orange,
  },
  listActions: {
    alignItems: 'center',
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  actionBtnText: {
    fontSize: 16,
  },
  expandHint: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  expandHintText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  itemsContainer: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noItemsText: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: 14,
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemCheckBtn: {
    padding: 4,
    marginLeft: 8,
  },
  itemCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  itemCheckboxChecked: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  itemCheckMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'right',
    marginRight: 4,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  qtyBadge: {
    backgroundColor: '#EDF2F7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginHorizontal: 6,
  },
  qtyText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  itemDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDeleteText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: 'bold',
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'right',
  },
  addItemQtyInput: {
    width: 65,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
  },
  addItemBtn: {
    backgroundColor: COLORS.primary,
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: COLORS.primary,
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
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
    borderRadius: 20,
    padding: 24,
    width: '88%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'right',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelBtnText: {
    color: COLORS.text,
    fontSize: 16,
  },
});
