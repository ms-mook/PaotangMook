# เป๋าตังค์ 💚

เว็บแอป (PWA) บันทึกรายรับ–รายจ่าย ติดตั้งบนหน้าจอมือถือได้ โยนสลิปโอนเงินเข้าไปแล้วแอปจะอ่าน QR บนสลิป (ธนาคาร + เลขอ้างอิง) กันบันทึกซ้ำ และเก็บรูปสลิปไว้ใน Google Drive

- **โค้ด**: GitHub → deploy อัตโนมัติขึ้น **Vercel** ทุกครั้งที่ push
- **ข้อมูลรายการ**: Google Sheets (เปิดดู/แก้เองได้)
- **รูปสลิป**: โฟลเดอร์ใน Google Drive
- **ล็อกอิน**: PIN (ใช้คนเดียว)

## ใช้งาน
- **📎 สลิป** — เลือกรูปสลิป แอปอ่าน QR ให้ แล้วกรอกยอดเงิน / หมวด → บันทึก
- **＋ จดรายการ** — จดรายรับ/รายจ่ายที่ไม่มีสลิป
- Android: กด "แชร์" รูปสลิปจากแอปธนาคาร → เลือก **เป๋าตังค์** ได้เลย
- แตะรายการเพื่อดูสลิปหรือลบ

> QR บนสลิปมีแค่ธนาคารผู้โอนและเลขอ้างอิง ไม่มียอดเงิน ยอดจึงต้องกรอกเอง (ถ้าเป็น QR พร้อมเพย์ที่ระบุยอดไว้ แอปจะเติมยอดให้)

---

## ตั้งค่าครั้งแรก

### 1. Google Cloud (ครั้งเดียว ~5 นาที)
1. ไปที่ https://console.cloud.google.com → สร้างโปรเจคใหม่ เช่น `paotang`
2. **APIs & Services → Library** เปิดใช้ **Google Drive API** และ **Google Sheets API**
3. **OAuth consent screen** → User type: External → ใส่ชื่อแอป/อีเมล → Scopes: เพิ่ม `.../auth/drive.file` → บันทึก
4. ⚠️ กด **Publish app** (เปลี่ยนเป็น *In production*) — ถ้าค้างไว้ที่ *Testing* refresh token จะหมดอายุทุก 7 วัน
   (scope `drive.file` ไม่ต้องรอ Google verify — ตอนล็อกอินจะเห็นคำเตือน "unverified app" ให้กด Advanced → Go to …)
5. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized redirect URI: `https://<โดเมน-vercel-ของคุณ>/api/google/callback`
   - จด **Client ID** และ **Client secret**

### 2. Vercel
1. https://vercel.com/new → Import repo `ms-mook/PaotangMook` → Deploy
2. **Settings → Environment Variables** ใส่:

| ชื่อ | ค่า |
|---|---|
| `APP_PIN` | PIN 4–8 หลัก |
| `AUTH_SECRET` | ข้อความสุ่มยาว ๆ (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | จากข้อ 1.5 |
| `GOOGLE_CLIENT_SECRET` | จากข้อ 1.5 |

3. **Deployments → Redeploy**

### 3. เชื่อม Google Drive
1. เปิด `https://<โดเมน>/setup` (ใส่ PIN) → กด **เชื่อมบัญชี Google**
2. แอปจะสร้างชีต "เป๋าตังค์ - รายรับรายจ่าย" และโฟลเดอร์ "เป๋าตังค์ - สลิป" ใน Drive ของคุณ แล้วแสดง 3 ค่า:
   `GOOGLE_REFRESH_TOKEN`, `SHEET_ID`, `DRIVE_FOLDER_ID`
3. ใส่ทั้ง 3 ค่าใน Vercel → Redeploy อีกครั้ง → เสร็จ 🎉

### 4. ติดตั้งบนมือถือ
- **iPhone (Safari)**: ปุ่มแชร์ → *เพิ่มไปยังหน้าจอโฮม*
- **Android (Chrome)**: กดปุ่ม *ติดตั้ง* ในแอป หรือเมนู ⋮ → *ติดตั้งแอป*

---

## พัฒนาบนเครื่อง
```bash
cp .env.example .env.local   # ใส่ค่า
npm install
npm run dev
```
(ถ้าจะทดสอบ /setup บนเครื่อง ให้เพิ่ม `http://localhost:3000/api/google/callback` ใน redirect URI ด้วย)

## โครงสร้าง
```
app/page.tsx              หน้าหลัก: สรุปรายเดือน + รายการ
app/login, app/setup      PIN และหน้าเชื่อม Google
app/api/transactions      อ่าน/เพิ่ม/ลบรายการ (Sheets) + อัปสลิป (Drive)
app/api/slip/[id]         แสดงรูปสลิปจาก Drive
app/api/google/*          OAuth ครั้งแรก
components/               AddSheet (ฟอร์ม + อ่าน QR), DetailSheet
lib/google.ts             Google Drive/Sheets REST client
lib/slipqr.ts             แกะ QR สลิป / พร้อมเพย์
lib/image.ts              ย่อรูป + สแกน QR ในเบราว์เซอร์ (jsQR)
proxy.ts                  ตรวจ session ทุก request
public/sw.js              service worker (offline shell + share target)
```

## หมายเหตุความปลอดภัย
- แอปใช้ scope `drive.file` → เห็นเฉพาะไฟล์ที่แอปสร้างเอง ไม่เห็นไฟล์อื่นใน Drive
- ห้าม commit `.env*` (มีใน `.gitignore` แล้ว) — ค่าลับทั้งหมดอยู่ใน Vercel เท่านั้น
