# בוט תמלול הודעות קוליות ל-WhatsApp

שרת קטן שמאזין להודעות קוליות שמגיעות ל-WhatsApp שלך, שולח אותן לתמלול אצל OpenAI (Whisper), ומחזיר את הטקסט כהודעת תשובה.

## מה יש בקובץ הזה

- `server.js` - כל הלוגיקה (אימות ה-webhook מול מטא, הורדת קובץ קול, תמלול, שליחת תשובה).
- `package.json` - רשימת התלויות (Express בלבד).
- `.env.example` - רשימת שמות המשתנים הסביבתיים הדרושים (בלי ערכים אמיתיים).

## דרישות מקדימות

1. אפליקציית Meta for Developers עם WhatsApp מחובר (כבר עשית את זה - "עסק מגן").
2. מפתח Access Token תקף (כרגע יש לך אחד זמני ל-24 שעות; בהמשך תצטרך אחד קבוע דרך "Step 2/3" באותו עמוד).
3. חשבון ב-platform.openai.com עם מפתח API (זה שירות בתשלום לפי שימוש, עלות תמלול נמוכה מאוד לדקה).

## פריסה (Deployment) - שלב אחר שלב

**חשוב: את כל הפעולות האלה תעשה בעצמך בדפדפן, אני רק מנחה. אני לא נכנס עם סיסמאות או מפתחות בשבילך.**

### שלב 1: הקוד כבר ב-GitHub

הקוד נמצא ב-repo הזה. ב-Render, תבחר "Public Git Repository" ותדביק את הכתובת של ה-repo הזה.

### שלב 2: להגדיר את השירות ב-Render

- Build command: `npm install`
- Start command: `npm start`
- Environment: Node

### שלב 3: להזין את משתני הסביבה

ב-Render, תחת "Environment", תוסיף את ארבעת המשתנים מתוך `.env.example`, עם הערכים האמיתיים שלך:

- `VERIFY_TOKEN` - תמציא בעצמך מחרוזת אקראית כלשהי (למשל `mulik-secret-2026`), תזכור אותה לשלב הבא.
- `WHATSAPP_TOKEN` - האסימון מהעמוד של מטא (זה שכבר יצרת).
- `WHATSAPP_PHONE_ID` - ה-Phone Number ID שרשום שם.
- `OPENAI_API_KEY` - המפתח מ-platform.openai.com.

### שלב 4: לקבל את כתובת השרת

אחרי הפריסה, Render ייתן לך כתובת כמו `https://whatsapp-transcribe-xxxx.onrender.com`.

### שלב 5: לחבר את ה-Webhook במטא

בעמוד WhatsApp באפליקציה שלך במטא, תחת "Configuration" (או "Webhooks"):

- Callback URL: `https://<הכתובת-שלך-מ-Render>/webhook`
- Verify token: בדיוק מה שהזנת ב-`VERIFY_TOKEN` למעלה.
- תסמן מנוי (Subscribe) לשדה `messages`.

אם האימות מצליח, מטא תשמור את ה-webhook, וכל הודעה קולית שתישלח למספר שלך תתומלל אוטומטית ותקבל תשובה עם הטקסט.

## הערת אבטחה

אף אחד מהמפתחות (Access Token / OpenAI key) לא נכתב בקבצים האלה ולא יעבור דרכי. אתה מזין אותם ישירות בממשק של Render.
