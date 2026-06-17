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
  addCategory,
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

const CAT_ICON_OPTIONS = [
  '🍞', '🥖', '🥐', '🧀', '🥚', '🥩', '🍗', '🍖', '🌭', '🍕', '🍔', '🌮', '🥗', '🍜', '🍝', '🍣', '🍱', '🍙', '🍚', '🍛',
  '🥫', '🫘', '🧄', '🧅', '🌶️', '🥜', '🥕', '🍅', '🥒', '🥬', '🥦', '🍆', '🫑', '🌽', '🥔',
  '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🥝', '🥭', '🍍',
  '🥛', '🧃', '🥤', '☕', '🍵', '🧊', '🍿', '🧈', '🫒', '🍯', '🍫', '🍪', '🎂', '🍰', '🍩',
  '🧴', '🧼', '🪥', '🧽', '🧻', '🫧', '💊', '💉', '🩹', '🩺',
  '🔌', '🔋', '💡', '🔧', '🪛', '🔨', '🧲', '⚙️', '🛠️', '📱', '💻', '🖨️', '📀', '🎧', '📷',
  '👕', '👖', '👗', '👟', '👠', '🧦', '🧤', '🧣', '👒', '🎽', '👓', '⌚', '💍', '👜', '🎒', '🧳',
  '🐱', '🐶', '🐦', '🐟', '🐰', '🐹',
  '⚽', '🏀', '🎾', '🏊', '🚴', '🎮', '🎯', '🎨', '🎵',
  '🏠', '🛋️', '🛏️', '🪑', '🧹', '🪣', '🧯', '🪴', '💈',
  '🚗', '🚕', '🛵', '⛽', '🚌',
  '📦', '🛒', '🎁', '📚', '✏️', '📎', '🗂️', '💰', '🏷️', '⭐', '❤️', '🔑',
];

export default function ShoppingListScreen() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [mergedCategories, setMergedCategories] = useState(SHOPPING_CATEGORIES);

  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [qtyItemName, setQtyItemName] = useState('');
  const [qtyValue, setQtyValue] = useState('1');

  const [addNewModalVisible, setAddNewModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemCategoryId, setNewItemCategoryId] = useState(null);
  const [newItemNewCategoryName, setNewItemNewCategoryName] = useState('');
  const [newItemNewCategoryIcon, setNewItemNewCategoryIcon] = useState('📦');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [listDate, setListDate] = useState(getTodayString());
  const [listNotifyDate, setListNotifyDate] = useState('');

  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [expenseListId, setExpenseListId] = useState(null);
  const [expenseListName, setExpenseListName] = useState('');
  const [expenseListDate, setExpenseListDate] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

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

    try {
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
    } catch (e) {
      console.log('Error creating list:', e);
      Alert.alert('خطا', 'مشکلی در ساخت لیست پیش آمد');
    }
  };

  const cancelListNotifications = async (list) => {
    if (list.notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(list.notification_id);
      } catch (e) {}
    }
    if (list.notification_id_next) {
      try {
        await Notifications.cancelScheduledNotificationAsync(list.notification_id_next);
      } catch (e) {}
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
    if (!expandedId) return;
    try {
      await addShoppingItem(db, {
        listId: expandedId,
        name: qtyItemName,
        quantity: qtyValue.trim() || '1',
      });
      await loadItems(expandedId);
      loadLists();
      setQtyModalVisible(false);
    } catch (e) {
      console.log('Error adding item:', e);
    }
  };

  const handleOpenAddNew = () => {
    setNewItemName('');
    setNewItemQty('1');
    setNewItemCategoryId(null);
    setNewItemNewCategoryName('');
    setNewItemNewCategoryIcon('📦');
    setShowNewCategoryInput(false);
    setAddNewModalVisible(true);
  };

  const handleSaveNewItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('خطا', 'نام کالا را وارد کنید');
      return;
    }

    try {
      let categoryId = newItemCategoryId;

      if (showNewCategoryInput) {
        if (!newItemNewCategoryName.trim()) {
          Alert.alert('خطا', 'نام دسته‌بندی جدید را وارد کنید');
          return;
        }
        await addCustomShoppingCategory(db, newItemNewCategoryName.trim(), newItemNewCategoryIcon);
        const cats = await getCustomShoppingCategories(db);
        const newCat = cats.find((c) => c.name === newItemNewCategoryName.trim());
        if (newCat) categoryId = `custom_${newCat.id}`;
      }

      if (categoryId) {
        await addCustomCatalogItem(db, categoryId, newItemName.trim());
      }

      if (expandedId) {
        await addShoppingItem(db, {
          listId: expandedId,
          name: newItemName.trim(),
          quantity: newItemQty.trim() || '1',
        });
        await loadItems(expandedId);
        loadLists();
      }

      await loadMergedCategories();
      setAddNewModalVisible(false);
    } catch (e) {
      console.log('Error saving new item:', e);
      Alert.alert('خطا', 'مشکلی در ذخیره آیتم پیش آمد');
    }
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

  const handleAddExpense = (list) => {
    setExpenseListId(list.id);
    setExpenseListName(list.name);
    setExpenseListDate(gregorianToJalali(list.date));
    setExpenseAmount('');
    setExpenseModalVisible(true);
  };

  const handleSubmitExpense = async () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      Alert.alert('خطا', 'مبلغ را وارد کنید');
      return;
    }

    try {
      let cats = await getCategories(db, 'expense');
      let shoppingCat = cats.find((c) => c.name === 'خرید');
      if (!shoppingCat) {
        await addCategory(db, { name: 'خرید', icon: '🛒', type: 'expense' });
        cats = await getCategories(db, 'expense');
        shoppingCat = cats.find((c) => c.name === 'خرید');
      }

      await addTransaction(db, {
        amount: parseFloat(expenseAmount),
        categoryId: shoppingCat.id,
        description: `🛒 ${expenseListName}`,
        date: expenseListDate,
        type: 'expense',
      });

      setExpenseModalVisible(false);
      const currentListId = expenseListId;

      Alert.alert(
        'هزینه ثبت شد',
        `هزینه "${expenseListName}" به مبلغ ${expenseAmount} تومان ثبت شد.\nلیست خرید رو حذف کنم؟`,
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
    } catch (e) {
      console.log('Error submitting expense:', e);
      Alert.alert('خطا', 'مشکلی در ثبت هزینه پیش آمد');
    }
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

    try {
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
              `امروز روز "${editName.trim()}" ته! اگه خرید کردی جمع لیست رو بگو. اگه نکردی تاریخ رو تغییر بده`,
              notifyDateObj
            );
          } catch (e) {}
          const nextDayObj = new Date(notifyDateObj);
          nextDayObj.setDate(nextDayObj.getDate() + 1);
          nextDayObj.setHours(9, 0, 0, 0);
          try {
            notificationIdNext = await scheduleDateNotification(
              'تاریخ لیست خرید گذشته! ⚠️',
              `تاریخ لیست "${editName.trim()}" گذشته! تاریخش رو عوض کن`,
              nextDayObj
            );
          } catch (e) {}
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
    } catch (e) {
      console.log('Error saving edit:', e);
      Alert.alert('خطا', 'مشکلی در ذخیره تغییرات پیش آمد');
    }
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
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
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
                    <View style={[styles.checkbox, list.is_completed && styles.checkboxChecked]}>
                      {list.is_completed && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, list.is_completed && styles.listNameCompleted]}>
                      {list.name}
                    </Text>
                    <View style={styles.listMeta}>
                      <Text style={styles.listDate}>📅 {gregorianToJalali(list.date)}</Text>
                      {list.notify_date && (
                        <Text style={styles.listNotify}>🔔 {gregorianToJalali(list.notify_date)}</Text>
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
                      <Text style={styles.badgeText}>{list.checked_items}/{list.total_items}</Text>
                    </View>
                    <View style={styles.actionBtns}>
                      <TouchableOpacity onPress={() => handleOpenEdit(list)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleShareList(list)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>📤</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteList(list)} style={styles.actionBtn}>
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

                {list.is_completed && list.total_items > 0 && !list.is_purchased && (
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
                  {expandedItems.length === 0 && (
                    <Text style={styles.noItemsText}>هنوز آیتمی اضافه نشده</Text>
                  )}

                  {expandedItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <TouchableOpacity onPress={() => handleToggleItem(item)} style={styles.itemCheckBtn}>
                        <View style={[styles.itemCheckbox, item.is_checked && styles.itemCheckboxChecked]}>
                          {item.is_checked && <Text style={styles.itemCheckMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
                        {item.name}
                      </Text>
                      {item.quantity ? (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyText}>×{item.quantity}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.itemDeleteBtn}>
                        <Text style={styles.itemDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

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
                  </View>

                  <TouchableOpacity style={styles.addNewItemBtn} onPress={handleOpenAddNew}>
                    <Text style={styles.addNewItemBtnText}>+ آیتم جدید</Text>
                  </TouchableOpacity>

                  <View style={styles.expandedActions}>
                    <TouchableOpacity
                      style={styles.saveListBtn}
                      onPress={() => {
                        setExpandedId(null);
                        setExpandedItems([]);
                      }}
                    >
                      <Text style={styles.saveListBtnText}>✓ ذخیره و بستن</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelListBtn}
                      onPress={() => {
                        setExpandedId(null);
                        setExpandedItems([]);
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

      <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create List Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
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

      {/* Expense Modal - Simplified */}
      <Modal visible={expenseModalVisible} transparent animationType="slide" onRequestClose={() => setExpenseModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>💰</Text>
              <Text style={styles.modalTitle}>ثبت هزینه خرید</Text>
            </View>

            <View style={styles.expenseInfoCard}>
              <Text style={styles.expenseInfoIcon}>🛒</Text>
              <View>
                <Text style={styles.expenseInfoName}>{expenseListName}</Text>
                <Text style={styles.expenseInfoDate}>📅 {expenseListDate}</Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>مبلغ کل خرید (تومان)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="مثلاً ۵۰۰۰۰۰"
              keyboardType="numeric"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />

            <Text style={styles.expenseNote}>
              هزینه با نام «{expenseListName}» در دسته‌بندی خرید ثبت میشه
            </Text>

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
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
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

      {/* Quantity Modal */}
      <Modal visible={qtyModalVisible} transparent animationType="slide" onRequestClose={() => setQtyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
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
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setQtyModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>انصراف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add New Item Modal */}
      <Modal visible={addNewModalVisible} transparent animationType="slide" onRequestClose={() => setAddNewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>افزودن آیتم جدید</Text>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { marginBottom: 6 }]}>نام کالا</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="مثلاً پودر رختشویی"
                value={newItemName}
                onChangeText={setNewItemName}
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={[styles.label, { marginTop: 4, marginBottom: 6 }]}>تعداد</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="۱"
                value={newItemQty}
                onChangeText={setNewItemQty}
                keyboardType="default"
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={[styles.label, { marginTop: 4, marginBottom: 6 }]}>دسته‌بندی (اختیاری)</Text>
              {!showNewCategoryInput ? (
                <>
                  {mergedCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.customCatOption,
                        newItemCategoryId === cat.id && styles.customCatOptionActive,
                      ]}
                      onPress={() => setNewItemCategoryId(cat.id)}
                    >
                      <Text style={styles.customCatOptionIcon}>{cat.icon}</Text>
                      <Text style={[
                        styles.customCatOptionText,
                        newItemCategoryId === cat.id && styles.customCatOptionTextActive,
                      ]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.newCategoryToggle}
                    onPress={() => { setShowNewCategoryInput(true); setNewItemCategoryId(null); }}
                  >
                    <Text style={styles.newCategoryToggleText}>+ ساخت دسته جدید</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="نام دسته جدید (مثلاً لوازم ورزشی)"
                    value={newItemNewCategoryName}
                    onChangeText={setNewItemNewCategoryName}
                    placeholderTextColor={COLORS.textLight}
                  />
                  <Text style={[styles.label, { marginTop: 4, marginBottom: 6 }]}>آیکون:</Text>
                  <View style={styles.newCatIconGrid}>
                    {CAT_ICON_OPTIONS.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.newCatIconOption,
                          newItemNewCategoryIcon === icon && styles.newCatIconOptionActive,
                        ]}
                        onPress={() => setNewItemNewCategoryIcon(icon)}
                      >
                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.newCategoryToggle}
                    onPress={() => { setShowNewCategoryInput(false); setNewItemNewCategoryName(''); }}
                  >
                    <Text style={styles.newCategoryToggleText}>← انتخاب از دسته‌های موجود</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 12 }]}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveNewItem}>
                <Text style={styles.modalSaveBtnText}>ذخیره و افزودن</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddNewModalVisible(false)}
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
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 40, alignItems: 'center', marginTop: 40, elevation: 2 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  listWrapper: { marginBottom: 12 },
  listCard: { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  listCardCompleted: { opacity: 0.65 },
  listCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  progressBarBg: { height: 4, backgroundColor: COLORS.border },
  progressBarFill: { height: 4, borderRadius: 2 },
  listHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  checkBtn: { padding: 4, marginLeft: 10 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  checkboxChecked: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  listInfo: { flex: 1, marginRight: 4 },
  listName: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  listNameCompleted: { textDecorationLine: 'line-through', color: COLORS.textLight },
  listMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  listDate: { fontSize: 12, color: COLORS.textLight },
  listNotify: { fontSize: 12, color: COLORS.orange },
  listActions: { alignItems: 'center' },
  badge: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 16 },
  expandHint: { alignItems: 'center', paddingBottom: 8 },
  expandHintText: { fontSize: 11, color: COLORS.textLight },
  statusBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  statusPurchased: { backgroundColor: '#E8F5E9' },
  statusPending: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextPurchased: { color: '#2E7D32' },
  statusTextPending: { color: '#E65100' },
  addExpenseBtn: { backgroundColor: COLORS.green, marginHorizontal: 14, marginBottom: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center', elevation: 2 },
  addExpenseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  itemsContainer: { backgroundColor: COLORS.card, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  noItemsText: { textAlign: 'center', color: COLORS.textLight, fontSize: 14, paddingVertical: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemCheckBtn: { padding: 4, marginLeft: 8 },
  itemCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  itemCheckboxChecked: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  itemCheckMark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  itemName: { flex: 1, fontSize: 15, color: COLORS.text, textAlign: 'right', marginRight: 4 },
  itemNameChecked: { textDecorationLine: 'line-through', color: COLORS.textLight },
  qtyBadge: { backgroundColor: COLORS.primaryLight || '#EDF2F7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 6 },
  qtyText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  itemDeleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  itemDeleteText: { color: COLORS.red, fontSize: 13, fontWeight: 'bold' },
  catalogContainer: { marginTop: 10 },
  catalogHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  catalogHeaderOpen: { backgroundColor: COLORS.primaryLight || '#E8F0FE', borderColor: COLORS.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  catalogHeaderIcon: { fontSize: 20, marginLeft: 8 },
  catalogHeaderText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  catalogHeaderArrow: { fontSize: 11, color: COLORS.textLight },
  catalogItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: COLORS.card, borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.primary, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginBottom: 4 },
  catalogItem: { backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  catalogItemAdded: { backgroundColor: '#E8F5E9', borderColor: COLORS.green },
  catalogItemText: { fontSize: 13, color: COLORS.text },
  catalogItemTextAdded: { color: COLORS.green },
  expandedActions: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveListBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', elevation: 2 },
  saveListBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelListBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  cancelListBtnText: { color: COLORS.textLight, fontSize: 14 },
  addNewItemBtn: { marginTop: 10, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', elevation: 2 },
  addNewItemBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 20, left: 20, backgroundColor: COLORS.primary, width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, width: '100%', maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalIcon: { fontSize: 40, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  modalInput: { backgroundColor: COLORS.background, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border, textAlign: 'right', marginBottom: 12 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalSaveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: 2 },
  modalSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCancelBtn: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  modalCancelBtnText: { color: COLORS.textLight, fontSize: 16 },
  expenseInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 14, padding: 14, marginBottom: 16, gap: 12 },
  expenseInfoIcon: { fontSize: 32 },
  expenseInfoName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  expenseInfoDate: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  expenseNote: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  customCatOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border },
  customCatOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight || '#E3F2FD' },
  customCatOptionIcon: { fontSize: 22, marginLeft: 10 },
  customCatOptionText: { fontSize: 15, color: COLORS.text },
  customCatOptionTextActive: { color: COLORS.primary, fontWeight: '700' },
  newCategoryToggle: { marginTop: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.primaryLight || '#F0F4FF', borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  newCategoryToggleText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  newCatIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16, paddingVertical: 8 },
  newCatIconOption: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border },
  newCatIconOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight || '#E3F2FD', elevation: 2 },
});
