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
  Platform,
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
  updateShoppingListNotification,
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
              title: 'یادآوری لیست خرید',
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
        text: 'بله',
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
    const itemLines = items.map((i) => {
      const check = i.is_checked ? '[x]' : '[ ]';
      const qty = i.quantity ? ` (${i.quantity})` : '';
      return `${check} ${i.name}${qty}`;
    });
    const text = `لیست خرید: ${list.name}\nتاریخ: ${gregorianToJalali(list.date)}\n\n${itemLines.join('\n')}`;

    try {
      await Share.share({ message: text });
    } catch (e) {
      console.log('Share failed:', e);
    }
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

        {lists.map((list) => (
          <View key={list.id}>
            <TouchableOpacity
              style={[
                styles.listCard,
                list.is_completed && styles.listCardCompleted,
              ]}
              onPress={() => handleExpand(list.id)}
              onLongPress={() => handleDeleteList(list)}
            >
              <View style={styles.listHeader}>
                <TouchableOpacity onPress={() => handleToggleComplete(list)}>
                  <Text style={styles.checkIcon}>
                    {list.is_completed ? '✅' : '⬜'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.listInfo}>
                  <Text style={[
                    styles.listName,
                    list.is_completed && styles.listNameCompleted,
                  ]}>
                    {list.name}
                  </Text>
                  <Text style={styles.listDate}>
                    {gregorianToJalali(list.date)}
                    {list.notify_date ? ` | یادآوری: ${gregorianToJalali(list.notify_date)}` : ''}
                  </Text>
                </View>
                <View style={styles.listBadge}>
                  <Text style={styles.listBadgeText}>
                    {list.checked_items}/{list.total_items}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleShareList(list)} style={styles.shareBtn}>
                  <Text style={styles.shareBtnText}>📤</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {expandedId === list.id && (
              <View style={styles.itemsContainer}>
                {expandedItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <TouchableOpacity onPress={() => handleToggleItem(item)}>
                      <Text style={styles.itemCheck}>
                        {item.is_checked ? '✅' : '⬜'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[
                      styles.itemName,
                      item.is_checked && styles.itemNameChecked,
                    ]}>
                      {item.name}
                    </Text>
                    {item.quantity ? (
                      <Text style={styles.itemQty}>{item.quantity}</Text>
                    ) : null}
                    <TouchableOpacity onPress={() => handleDeleteItem(item)}>
                      <Text style={styles.itemDelete}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addItemRow}>
                  <TextInput
                    style={styles.addItemInput}
                    placeholder="نام آیتم"
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
        ))}
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
            <Text style={styles.modalTitle}>لیست خرید جدید</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="نام لیست (مثلاً خرید هفتگی)"
              value={listName}
              onChangeText={setListName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>تاریخ خرید (شمسی)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۴/۰۳/۲۵"
              value={listDate}
              onChangeText={setListDate}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>تاریخ یادآوری (اختیاری)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۴/۰۳/۲۴"
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
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
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
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  listCardCompleted: {
    opacity: 0.6,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 22,
    marginLeft: 10,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  listNameCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  listDate: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 2,
  },
  listBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  listBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shareBtn: {
    padding: 4,
  },
  shareBtnText: {
    fontSize: 20,
  },
  itemsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemCheck: {
    fontSize: 18,
    marginLeft: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'right',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  itemQty: {
    fontSize: 13,
    color: COLORS.textLight,
    marginHorizontal: 8,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  itemDelete: {
    fontSize: 16,
    padding: 4,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'right',
  },
  addItemQtyInput: {
    width: 70,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
  },
  addItemBtn: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
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
    marginTop: 8,
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
