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
  addTransaction,
  getCategories,
  updateShoppingList,
  getCustomCatalogItems,
  addCustomCatalogItem,
  markShoppingListPurchased,
  getCustomShoppingCategories,
  addCustomShoppingCategory,
} from '../database/queries';
import {
  getTodayString,
  gregorianToJalali,
  jalaliToDate,
} from '../utils/date';
import { COLORS } from '../utils/colors';
import SHOPPING_CATEGORIES from '../utils/shoppingCategories';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const scheduleDateNotification = async (title, body, dateObj) => {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dateObj,
    },
  });
};

export default function ShoppingListScreen() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [mergedCategories, setMergedCategories] = useState(SHOPPING_CATEGORIES);

  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [qtyItemName, setQtyItemName] = useState('');
  const [qtyValue, setQtyValue] = useState('1');

  const [addCustomModalVisible, setAddCustomModalVisible] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customCategoryId, setCustomCategoryId] = useState(null);

  const [newCatModalVisible, setNewCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');

  const CAT_ICON_OPTIONS = ['📦', '🧃', '🍜', '🥤', '🧊', '🍿', '🧈', '🫒', '🍯', '🥫', '🫘', '🧄', '🧅', '🌶️', '🥜', '🫧', '🧻', '🪥', '🧲', '🔌', '🪛', '🛠️', '💈', '🎒', '👜', '🧳', '🎽', '👓', '⌚', '🖨️', '📀', '🔋', '🧯', '🪣'];

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [listDate, setListDate] = useState(getTodayString());
  const [listNotifyDate, setListNotifyDate] = useState('');

  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [expenseListId, setExpenseListId] = useState(null);
  const [expenseListName, setExpenseListName] = useState('');
  const [expenseListDate, setExpenseListDate] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editListId, setEditListId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotifyDate, setEditNotifyDate] = useState('');
  const [editOldNotificationId, setEditOldNotificationId] = useState(null);
  const [editOldNotificationIdNext, setEditOldNotificationIdNext] = useState(null);

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

  const loadMergedCategories = useCallback(async () => {
    const [customItems, customCats] = await Promise.all([
      getCustomCatalogItems(db),
      getCustomShoppingCategories(db),
    ]);
    const merged = SHOPPING_CATEGORIES.map((cat) => {
      const extras = customItems
        .filter((ci) => ci.category_id === cat.id)
        .map((ci) => ci.name)
        .filter((name) => !cat.items.includes(name));
      return extras.length > 0
        ? { ...cat, items: [...cat.items, ...extras] }
        : cat;
    });
    const userCats = customCats.map((cc) => {
      const items = customItems
        .filter((ci) => ci.category_id === `custom_${cc.id}`)
        .map((ci) => ci.name);
      return { id: `custom_${cc.id}`, name: cc.name, icon: cc.icon, items };
    });
    setMergedCategories([...merged, ...userCats]);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
      loadMergedCategories();
    }, [loadLists, loadMergedCategories])
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
    let notificationIdNext = null;
    if (listNotifyDate.trim()) {
      const notifyDateObj = jalaliToDate(listNotifyDate);
      if (notifyDateObj && notifyDateObj > new Date()) {
        notifyDateObj.setHours(22, 0, 0, 0);
        try {
          notificationId = await scheduleDateNotification(
            'یادآوری لیست خرید 🛒',
            `امروز روز "${listName.trim()}" ته! اگه خرید کردی جمع لیست رو بگو تا به هزینه‌ها اضافه کنم. اگه نکردی تاریخ رو تغییر بده`,
            notifyDateObj
          );
        } catch (e) {
          console.log('Failed to schedule notification:', e);
        }

        const nextDayObj = new Date(notifyDateObj);
        nextDayObj.setDate(nextDayObj.getDate() + 1);
        nextDayObj.setHours(9, 0, 0, 0);
        try {
          notificationIdNext = await scheduleDateNotification(
            'تاریخ لیست خرید گذشته! ⚠️',
            `تاریخ لیست "${listName.trim()}" گذشته! اگه هنوز خرید نکردی برو تاریخش رو عوض کن`,
            nextDayObj
          );
        } catch (e) {
          console.log('Failed to schedule next-day notification:', e);
        }
      }
    }

    await createShoppingList(db, {
      name: listName.trim(),
      date: listDate,
      notifyDate: listNotifyDate.trim() || null,
      notificationId,
      notificationIdNext,
    });

    setCreateModalVisible(false);
    setListName('');
    setListDate(getTodayString());
    setListNotifyDate('');
    loadLists();
  };

  const cancelListNotifications = async (list) => {
    if (list.notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(list.notification_id);
      } catch (e) {
        console.log('Failed to cancel notification:', e);
      }
    }
    if (list.notification_id_next) {
      try {
        await Notifications.cancelScheduledNotificationAsync(list.notification_id_next);
      } catch (e) {
        console.log('Failed to cancel next-day notification:', e);
      }
    }
  };

  const handleDeleteList = (list) => {
    Alert.alert('حذف لیست', `لیست "${list.name}" حذف بشه؟`, [
      { text: 'نه', style: 'cancel' },
      {
        text: 'بله، حذف کن',
        style: 'destructive',
        onPress: async () => {
          await cancelListNotifications(list);
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

  const handleCatalogItemPress = (itemName) => {
    setQtyItemName(itemName);
    setQtyValue('1');
    setQtyModalVisible(true);
  };

  const handleConfirmCatalogItem = async () => {
    if (!expandedId || !qtyItemName) return;
    await addShoppingItem(db, {
      listId: expandedId,
      name: qtyItemName,
      quantity: qtyValue.trim() || '1',
    });
    setQtyModalVisible(false);
    setQtyItemName('');
    setQtyValue('1');
    await loadItems(expandedId);
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

  const handleOpenAddCustom = () => {
    setCustomItemName('');
    setCustomCategoryId(null);
    setAddCustomModalVisible(true);
  };

  const handleSaveCustomItem = async () => {
    if (!customItemName.trim() || !customCategoryId) {
      Alert.alert('خطا', 'نام آیتم و دسته‌بندی را انتخاب کنید');
      return;
    }
    await addCustomCatalogItem(db, customCategoryId, customItemName.trim());
    setAddCustomModalVisible(false);
    await loadMergedCategories();
  };

  const handleSaveNewCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('خطا', 'نام دسته‌بندی را وارد کنید');
      return;
    }
    await addCustomShoppingCategory(db, newCatName.trim(), newCatIcon);
    setNewCatModalVisible(false);
    setNewCatName('');
    setNewCatIcon('📦');
    await loadMergedCategories();
  };

  const toggleCatalogCategory = (catId) => {
    setOpenCategoryId(openCategoryId === catId ? null : catId);
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

  const handleAddExpense = async (list) => {
    const cats = await getCategories(db, 'expense');
    setExpenseCategories(cats);
    setExpenseListId(list.id);
    setExpenseListName(list.name);
    setExpenseListDate(gregorianToJalali(list.date));
    setExpenseAmount('');
    setSelectedCategory(null);
    setExpenseModalVisible(true);
  };

  const handleSubmitExpense = async () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      Alert.alert('خطا', 'مبلغ را وارد کنید');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('خطا', 'دسته‌بندی را انتخاب کنید');
      return;
    }
    await addTransaction(db, {
      amount: parseFloat(expenseAmount),
      categoryId: selectedCategory.id,
      description: `لیست خرید: ${expenseListName}`,
      date: expenseListDate,
      type: 'expense',
    });
    setExpenseModalVisible(false);
    const currentListId = expenseListId;
    Alert.alert(
      'هزینه ثبت شد',
      `هزینه "${expenseListName}" ثبت شد. میخوای لیست خرید رو هم حذف کنی؟`,
      [
        {
          text: 'نه، نگهش دار',
          style: 'cancel',
          onPress: async () => {
            await markShoppingListPurchased(db, currentListId);
            loadLists();
          },
        },
        {
          text: 'بله، حذفش کن',
          style: 'destructive',
          onPress: async () => {
            const list = lists.find((l) => l.id === currentListId);
            if (list) await cancelListNotifications(list);
            await deleteShoppingList(db, currentListId);
            if (expandedId === currentListId) {
              setExpandedId(null);
              setExpandedItems([]);
            }
            loadLists();
          },
        },
      ]
    );
  };

  const handleOpenEdit = (list) => {
    setEditListId(list.id);
    setEditName(list.name);
    setEditDate(gregorianToJalali(list.date));
    setEditNotifyDate(list.notify_date ? gregorianToJalali(list.notify_date) : '');
    setEditOldNotificationId(list.notification_id);
    setEditOldNotificationIdNext(list.notification_id_next);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('خطا', 'نام لیست را وارد کنید');
      return;
    }

    if (editOldNotificationId) {
      try { await Notifications.cancelScheduledNotificationAsync(editOldNotificationId); } catch (e) {}
    }
    if (editOldNotificationIdNext) {
      try { await Notifications.cancelScheduledNotificationAsync(editOldNotificationIdNext); } catch (e) {}
    }

    let notificationId = null;
    let notificationIdNext = null;
    if (editNotifyDate.trim()) {
      const notifyDateObj = jalaliToDate(editNotifyDate);
      if (notifyDateObj && notifyDateObj > new Date()) {
        notifyDateObj.setHours(22, 0, 0, 0);
        try {
          notificationId = await scheduleDateNotification(
            'یادآوری لیست خرید 🛒',
            `امروز روز "${editName.trim()}" ته! اگه خرید کردی جمع لیست رو بگو تا به هزینه‌ها اضافه کنم. اگه نکردی تاریخ رو تغییر بده`,
            notifyDateObj
          );
        } catch (e) {
          console.log('Failed to schedule notification:', e);
        }

        const nextDayObj = new Date(notifyDateObj);
        nextDayObj.setDate(nextDayObj.getDate() + 1);
        nextDayObj.setHours(9, 0, 0, 0);
        try {
          notificationIdNext = await scheduleDateNotification(
            'تاریخ لیست خرید گذشته! ⚠️',
            `تاریخ لیست "${editName.trim()}" گذشته! اگه هنوز خرید نکردی برو تاریخش رو عوض کن`,
            nextDayObj
          );
        } catch (e) {
          console.log('Failed to schedule next-day notification:', e);
        }
      }
    }

    await updateShoppingList(db, editListId, {
      name: editName.trim(),
      date: editDate,
      notifyDate: editNotifyDate.trim() || null,
      notificationId,
      notificationIdNext,
    });

    setEditModalVisible(false);
    loadLists();
  };

  const handleShareList = async (list) => {
    const items = await getShoppingItems(db, list.id);

    const itemLines = items.map((i) => {
      const qty = i.quantity ? `  ×${i.quantity}` : '';
      return `• ${i.name}${qty}`;
    });

    const text = [
      `🛒 لیست خرید: ${list.name}`,
      `📅 ${gregorianToJalali(list.date)}`,
      '',
      ...itemLines,
      '',
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
                    <View style={[
                      styles.statusBadge,
                      list.is_purchased ? styles.statusPurchased : styles.statusPending,
                    ]}>
                      <Text style={[
                        styles.statusText,
                        list.is_purchased ? styles.statusTextPurchased : styles.statusTextPending,
                      ]}>
                        {list.is_purchased ? '✅ خریداری شده' : '⏳ در انتظار خرید'}
                      </Text>
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
                        onPress={() => handleOpenEdit(list)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
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

                {list.is_completed && list.total_items > 0 && (
                  <TouchableOpacity
                    style={styles.addExpenseBtn}
                    onPress={() => handleAddExpense(list)}
                  >
                    <Text style={styles.addExpenseBtnText}>💰 ثبت در مخارج</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.itemsContainer}>
                  {expandedItems.length === 0 && !showCatalog && (
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

                  {/* Manual add row */}
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

                  {/* Catalog toggle */}
                  <TouchableOpacity
                    style={styles.catalogToggle}
                    onPress={() => { setShowCatalog(!showCatalog); setOpenCategoryId(null); }}
                  >
                    <Text style={styles.catalogToggleText}>
                      {showCatalog ? '▲ بستن اقلام پیشنهادی' : '📋 انتخاب از اقلام پیشنهادی'}
                    </Text>
                  </TouchableOpacity>

                  {/* Catalog accordion */}
                  {showCatalog && (
                    <View style={styles.catalogContainer}>
                      {mergedCategories.map((cat) => {
                        const isOpen = openCategoryId === cat.id;
                        const existingNames = expandedItems.map((i) => i.name);
                        return (
                          <View key={cat.id}>
                            <TouchableOpacity
                              style={[styles.catalogHeader, isOpen && styles.catalogHeaderOpen]}
                              onPress={() => toggleCatalogCategory(cat.id)}
                            >
                              <Text style={styles.catalogHeaderIcon}>{cat.icon}</Text>
                              <Text style={styles.catalogHeaderText}>{cat.name}</Text>
                              <Text style={styles.catalogHeaderArrow}>{isOpen ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {isOpen && (
                              <View style={styles.catalogItems}>
                                {cat.items.map((itemName) => {
                                  const alreadyAdded = existingNames.includes(itemName);
                                  return (
                                    <TouchableOpacity
                                      key={itemName}
                                      style={[styles.catalogItem, alreadyAdded && styles.catalogItemAdded]}
                                      onPress={() => !alreadyAdded && handleCatalogItemPress(itemName)}
                                      disabled={alreadyAdded}
                                    >
                                      <Text style={[styles.catalogItemText, alreadyAdded && styles.catalogItemTextAdded]}>
                                        {alreadyAdded ? '✓ ' : '+ '}{itemName}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                      <View style={styles.catalogBottomBtns}>
                        <TouchableOpacity
                          style={styles.addCustomCatalogBtn}
                          onPress={handleOpenAddCustom}
                        >
                          <Text style={styles.addCustomCatalogBtnText}>+ افزودن آیتم</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.addCustomCatalogBtn, { backgroundColor: COLORS.green }]}
                          onPress={() => setNewCatModalVisible(true)}
                        >
                          <Text style={styles.addCustomCatalogBtnText}>+ دسته جدید</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Save / Close buttons */}
                  <View style={styles.expandedActions}>
                    <TouchableOpacity
                      style={styles.saveListBtn}
                      onPress={() => {
                        setExpandedId(null);
                        setExpandedItems([]);
                        setShowCatalog(false);
                      }}
                    >
                      <Text style={styles.saveListBtnText}>✓ ذخیره و بستن</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelListBtn}
                      onPress={() => {
                        setExpandedId(null);
                        setExpandedItems([]);
                        setShowCatalog(false);
                      }}
                    >
                      <Text style={styles.cancelListBtnText}>بستن</Text>
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

      {/* Expense Modal */}
      <Modal visible={expenseModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>💰</Text>
              <Text style={styles.modalTitle}>ثبت هزینه خرید</Text>
            </View>

            <Text style={styles.expenseListInfo}>
              لیست: {expenseListName}  |  📅 {expenseListDate}
            </Text>

            <Text style={styles.modalLabel}>مبلغ کل (تومان)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="مثلاً ۵۰۰۰۰۰"
              keyboardType="numeric"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>دسته‌بندی</Text>
            <ScrollView style={styles.categoryScroll} nestedScrollEnabled horizontal={false}>
              <View style={styles.categoryGrid}>
                {expenseCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory?.id === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                    <Text style={[
                      styles.categoryChipText,
                      selectedCategory?.id === cat.id && styles.categoryChipTextActive,
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSubmitExpense}>
                <Text style={styles.modalSaveBtnText}>ثبت هزینه</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setExpenseModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit List Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>✏️</Text>
              <Text style={styles.modalTitle}>ویرایش لیست خرید</Text>
            </View>

            <Text style={styles.modalLabel}>نام لیست</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="نام لیست"
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>📅 تاریخ خرید (شمسی)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۵/۰۳/۲۵"
              value={editDate}
              onChangeText={setEditDate}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalLabel}>🔔 تاریخ یادآوری (اختیاری)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="۱۴۰۵/۰۳/۲۴"
              value={editNotifyDate}
              onChangeText={setEditNotifyDate}
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveBtnText}>ذخیره تغییرات</Text>
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

      {/* Quantity Prompt Modal */}
      <Modal visible={qtyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعداد «{qtyItemName}»</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="تعداد (مثلاً ۲)"
              value={qtyValue}
              onChangeText={setQtyValue}
              keyboardType="default"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleConfirmCatalogItem}>
                <Text style={styles.modalSaveBtnText}>افزودن</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setQtyModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Custom Catalog Item Modal */}
      <Modal visible={addCustomModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>افزودن آیتم جدید به دسته‌بندی</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="نام آیتم"
              value={customItemName}
              onChangeText={setCustomItemName}
              placeholderTextColor={COLORS.textLight}
            />
            <Text style={[styles.label, { marginTop: 12, marginBottom: 8 }]}>انتخاب دسته‌بندی:</Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {mergedCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.customCatOption,
                    customCategoryId === cat.id && styles.customCatOptionActive,
                  ]}
                  onPress={() => setCustomCategoryId(cat.id)}
                >
                  <Text style={styles.customCatOptionIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.customCatOptionText,
                    customCategoryId === cat.id && styles.customCatOptionTextActive,
                  ]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveCustomItem}>
                <Text style={styles.modalSaveBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddCustomModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Category Modal */}
      <Modal visible={newCatModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ساخت دسته‌بندی جدید</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="نام دسته‌بندی (مثلاً لوازم ورزشی)"
              value={newCatName}
              onChangeText={setNewCatName}
              placeholderTextColor={COLORS.textLight}
            />
            <Text style={[styles.label, { marginTop: 12, marginBottom: 8 }]}>آیکون انتخاب کنید:</Text>
            <View style={styles.newCatIconGrid}>
              {CAT_ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.newCatIconOption,
                    newCatIcon === icon && styles.newCatIconOptionActive,
                  ]}
                  onPress={() => setNewCatIcon(icon)}
                >
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveNewCategory}>
                <Text style={styles.modalSaveBtnText}>ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewCatModalVisible(false)}
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
  addExpenseBtn: {
    backgroundColor: COLORS.green,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addExpenseBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  expenseListInfo: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryScroll: {
    maxHeight: 120,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F0FE',
  },
  categoryChipIcon: {
    fontSize: 14,
    marginLeft: 5,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.text,
  },
  categoryChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  catalogToggle: {
    marginTop: 12,
    backgroundColor: '#EDF2F7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  catalogToggleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  catalogContainer: {
    marginTop: 10,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catalogHeaderOpen: {
    backgroundColor: '#E8F0FE',
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  catalogHeaderIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  catalogHeaderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  catalogHeaderArrow: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  catalogItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginBottom: 4,
  },
  catalogItem: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catalogItemAdded: {
    backgroundColor: '#E8F5E9',
    borderColor: COLORS.green,
  },
  catalogItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
  catalogItemTextAdded: {
    color: COLORS.green,
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusPurchased: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextPurchased: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#E65100',
  },
  expandedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveListBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveListBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelListBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelListBtnText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  catalogBottomBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  addCustomCatalogBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  addCustomCatalogBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customCatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customCatOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E3F2FD',
  },
  customCatOptionIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  customCatOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  customCatOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  newCatIconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  newCatIconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  newCatIconOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E3F2FD',
  },
});
