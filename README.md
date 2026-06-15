# حسابدار من (Hesabdar Man)

اپلیکیشن مدیریت مالی شخصی - ساده، آفلاین و فارسی

## ویژگی‌ها

- **ثبت هزینه و درآمد** با دسته‌بندی
- **داشبورد** با خلاصه روزانه و ماهانه
- **گزارش ماهانه** با نمودار دایره‌ای و میله‌ای
- **بودجه‌بندی** با هشدار نزدیک شدن به سقف
- **پیشنهاد صرفه‌جویی** هوشمند بر اساس الگوی خرج

## تکنولوژی

- React Native + Expo SDK 56
- SQLite (ذخیره‌سازی آفلاین روی گوشی)
- React Navigation (Bottom Tabs)
- react-native-chart-kit

## نصب و اجرا

```bash
npm install
npx expo start
```

سپس اپلیکیشن **Expo Go** را روی گوشی نصب کنید و QR code را اسکن کنید.

## ساختار پروژه

```
├── App.js                    # نقطه ورودی - ناوبری و Provider
├── src/
│   ├── database/
│   │   ├── schema.js         # ساختار دیتابیس و مایگریشن
│   │   └── queries.js        # کوئری‌های CRUD
│   ├── screens/
│   │   ├── DashboardScreen.js
│   │   ├── AddTransactionScreen.js
│   │   ├── ReportScreen.js
│   │   ├── BudgetScreen.js
│   │   └── TipsScreen.js
│   └── utils/
│       ├── date.js           # توابع تاریخ و فرمت
│       └── colors.js         # ثابت‌های رنگ
```

## لایسنس

MIT
