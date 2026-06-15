import { View, Text, I18nManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { migrateDbIfNeeded } from './src/database/schema';
import DashboardScreen from './src/screens/DashboardScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import ReportScreen from './src/screens/ReportScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import TipsScreen from './src/screens/TipsScreen';
import { COLORS } from './src/utils/colors';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  'داشبورد': '🏠',
  'ثبت': '➕',
  'گزارش': '📊',
  'بودجه': '💳',
  'نکات': '💡',
};

export default function App() {
  return (
    <SQLiteProvider databaseName="hesabdar.db" onInit={migrateDbIfNeeded}>
      <NavigationContainer>
        <StatusBar style="light" />
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
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textLight,
            tabBarStyle: {
              backgroundColor: COLORS.card,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              height: 60,
              paddingBottom: 8,
              paddingTop: 4,
            },
            tabBarIcon: ({ focused }) => {
              const icon = TAB_ICONS[route.name] || '📌';
              return (
                <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
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
  );
}
