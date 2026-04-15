VParts FULL BUILD

מה יש במערכת:
- Electron + Node + SQLite
- טעינת PDF או תמונה
- זיהוי חלקים לפי עמוד או לכל המסמך
- רשימת חלקים מסוננת לפי עמוד / כל המסמך
- נקודות על המסמך
- שמירת קטלוגים למסד
- שמירת הזמנות למסד
- מספר הזמנה אוטומטי: YYYY-0001
- תאריך ישראלי בכל הממשק
- מחלקה לבחירה + הוספת מחלקה חדשה
- שורות הזמנה: PN, שם חלק, כמות, דחיפות, הערה
- גלגלת מעל PDF למעבר עמודים
- Ctrl + גלגלת לזום
- ALT מעל PDF לזכוכית מגדלת
- ייצוא TXT
- הדפסה
- שליחה במייל

איך להריץ:
1. חלץ את ה-ZIP
2. פתח PowerShell בתוך התיקייה
3. הרץ:
   npm install
   npm start

או לחץ פעמיים על:
   start-vparts.bat

אם better-sqlite3 לא נבנה:
   npm run rebuild
   npm start

מבנה:
- src/main.js
- src/preload.js
- src/db/database.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/renderer.js
- src/assets/icon.ico
- src/assets/yv-logo.png