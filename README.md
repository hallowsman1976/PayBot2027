# MeeTung

แอปจดรายรับรายจ่ายของครัวเรือน แชร์กระเป๋าได้ และบอกว่าเดือนนี้เหลือใช้เท่าไร ตกวันละกี่บาท

- คำศัพท์ของโดเมน: [GLOSSARY.md](GLOSSARY.md)
- การตัดสินใจสำคัญ: [docs/adr/](docs/adr/)

## โครงสร้าง

```
app/   Vite + TypeScript + React (ห่อด้วย Capacitor เป็นแอปมือถือ)
  src/domain/  กฎทางการเงินล้วน ๆ (รอบ, เหลือใช้, กระปุก, ยอดกระเป๋า, แป้นคิดเลข) + เทสต์
  src/data/    ข้อมูลในเครื่อง, outbox + ซิงก์, ล็อกอิน, ตัวคุยกับ GAS และเซิร์ฟเวอร์จำลอง
  src/ui/      หน้าจอ
gas/   Google Apps Script Web App เก็บข้อมูลลง Google Sheets
```

## รันในเครื่อง (ไม่ต้องมี GAS)

```bash
cd app
npm install
npm run dev
```

ถ้ายังไม่ได้ตั้งค่า `.env` แอปจะใช้เซิร์ฟเวอร์จำลองในเบราว์เซอร์ และล็อกอินด้วยอีเมลอะไรก็ได้
ลองแชร์กระเป๋าได้โดยล็อกอินเป็นคนที่หนึ่ง สร้างรหัสเชิญ ออกจากระบบ แล้วล็อกอินเป็นอีกอีเมลเพื่อใช้รหัสนั้น

```bash
npm test
```

## ตั้งค่า GAS backend

1. สร้าง OAuth Client ID ชนิด **Web application** ใน Google Cloud Console ใส่ `http://localhost:5173` ใน Authorized JavaScript origins
2. สร้าง Apps Script project ใหม่ แล้ว `cp gas/.clasp.json.example gas/.clasp.json` ใส่ `scriptId` จากนั้น `cd gas && npx @google/clasp push`
3. ใน Project Settings → Script Properties ใส่
   - `GOOGLE_CLIENT_ID` = Client ID จากข้อ 1
   - `HOUSEHOLD_EMAILS` = อีเมลของทุกคนในครัวเรือน คั่นด้วยจุลภาค
4. รันฟังก์ชัน `setup` ในหน้า editor หนึ่งครั้ง ระบบจะสร้างแท็บ Wallets, Transactions, Categories, Jars, Settings, Invites ในชีตตาม `DEFAULT_SPREADSHEET_ID` ใน `gas/Db.js` (เปลี่ยนชีตได้ด้วย Script Property `SPREADSHEET_ID`)
5. Deploy → New deployment → Web app, Execute as **Me**, Who has access **Anyone** แล้วคัดลอก URL ที่ลงท้ายด้วย `/exec`
6. สร้าง `app/.env` จาก `app/.env.example` ใส่ `VITE_GAS_URL` และ `VITE_GOOGLE_CLIENT_ID`

ทุกครั้งที่แก้โค้ดใน `gas/` ต้อง push แล้ว deploy เป็นเวอร์ชันใหม่ ไม่อย่างนั้น URL `/exec` ยังรันโค้ดเก่า

## แอปมือถือ (Capacitor)

```bash
cd app
npm run build
npx cap add android   # หรือ ios
npx cap sync
```

Google Sign-In แบบเว็บยังใช้ใน WebView ของแอปมือถือไม่ได้ ต้องเพิ่ม plugin ล็อกอินแบบ native ก่อนใช้กับ GAS บนมือถือ
