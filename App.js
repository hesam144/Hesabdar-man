import { useState, useEffect, useCallback } from 'react';
import { Text, I18nManager, View, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { migrateDbIfNeeded } from './src/database/schema';
import DashboardScreen from './src/screens/DashboardScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';
import ReportScreen from './src/screens/ReportScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import TipsScreen from './src/screens/TipsScreen';
import { COLORS, setTheme } from './src/utils/colors';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  'داشبورد': '🏠',
  'ثبت': '➕',
  'خرید': '🛒',
  'گزارش': '📊',
  'بودجه': '💳',
  'نکات': '💡',
};

async function scheduleDailyReminder() {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const hasDaily = existing.some((n) => n.content.data?.type === 'daily_reminder');
    if (hasDaily) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'حسابدار من 📝',
        body: 'امروز خرجی نداشتی؟ هزینه‌هات رو ثبت کن!',
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });
  } catch (e) {
    console.log('Failed to schedule daily reminder:', e);
  }
}

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        scheduleDailyReminder();
      }
    })();
  }, []);

  const toggleDarkMode = useCallback(() => {
    const newDark = !isDark;
    setIsDark(newDark);
    setTheme(newDark);
    forceUpdate((n) => n + 1);
  }, [isDark]);

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="hesabdar.db" onInit={migrateDbIfNeeded}>
        <NavigationContainer>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: {
                backgroundColor: COLORS.primary,
                elevation: 0,
                shadowOpacity: 0,
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 18,
              },
              headerRight: () => (
                <TouchableOpacity
                  onPress={toggleDarkMode}
                  style={{ marginRight: 14, padding: 6 }}
                >
                  <Text style={{ fontSize: 20 }}>{isDark ? '☀️' : '🌙'}</Text>
                </TouchableOpacity>
              ),
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.textLight,
              tabBarStyle: {
                backgroundColor: COLORS.card,
                borderTopWidth: 1,
                borderTopColor: COLORS.border,
                paddingTop: 4,
              },
              tabBarLabelStyle: {
                fontSize: 10,
              },
              tabBarIcon: ({ focused }) => {
                const icon = TAB_ICONS[route.name] || '📌';
                return (
                  <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>
                    {icon}
                  </Text>
                );
              },
            })}
          >
            <Tab.Screen
              name="داشبورد"
              component={DashboardScreen}
              options={{ title: 'داشبورد' }}
            />
            <Tab.Screen
              name="ثبت"
              component={AddTransactionScreen}
              options={{ title: 'ثبت هزینه / درآمد' }}
            />
            <Tab.Screen
              name="خرید"
              component={ShoppingListScreen}
              options={{ title: 'لیست خرید' }}
            />
            <Tab.Screen
              name="گزارش"
              component={ReportScreen}
              options={{ title: 'گزارش ماهانه' }}
            />
            <Tab.Screen
              name="بودجه"
              component={BudgetScreen}
              options={{ title: 'بودجه‌بندی' }}
            />
            <Tab.Screen
              name="نکات"
              component={TipsScreen}
              options={{ title: 'صرفه‌جویی' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
