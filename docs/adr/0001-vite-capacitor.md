# เว็บแอป Vite + TypeScript ห่อด้วย Capacitor

ผู้พัฒนาเลือกเขียนแอปเป็น Vite + TypeScript แทน Flutter หรือ native แต่ PWA ล้วนอ่านแจ้งเตือนธนาคารบน Android ไม่ได้ ทำ widget หน้าโฮมไม่ได้ และรับไฟล์ที่แชร์เข้ามาบน iOS ไม่ได้ จึงห่อเว็บแอปด้วย Capacitor เป็นแอป Android/iOS โค้ดหลักเป็น TypeScript ทั้งหมด ส่วนที่ต้องเขียน native (Kotlin/Swift) จำกัดไว้แค่ตัวอ่านแจ้งเตือน widget และส่วนที่ Shortcuts เรียกใช้

## Considered Options

- **PWA ล้วน**: ตัดทิ้ง เพราะทำฟีเจอร์จดอัตโนมัติและ widget ไม่ได้
- **Flutter**: ฟีเจอร์ native ครบกว่า แต่ไม่ตรงกับ stack ที่ผู้พัฒนาเลือก
