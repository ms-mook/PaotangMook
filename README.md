# เป๋าตังค์ 💚

เว็บแอป (PWA) บันทึกรายรับ–รายจ่าย ติดตั้งบนหน้าจอมือถือได้ โยนสลิปโอนเงินเข้าไปแล้วแอปจะอ่าน QR บนสลิป (ธนาคาร + เลขอ้างอิง) กันบันทึกซ้ำ และเก็บรูปสลิปไว้ใน Google Drive

- **โค้ด**: GitHub → deploy อัตโนมัติขึ้น **Vercel** ทุกครั้งที่ push
- **ข้อมูลรายการ**: Google Sheets (เปิดดู/แก้เองได้)
- **รูปสลิป**: โฟลเดอร์ใน Google Drive (ผ่าน Google Apps Script ไม่ต้องใช้ Google Cloud)
- **ล็อกอิน**: PIN (ใช้คนเดียว)

## ใช้งาน
- **📎 สลิป** — เลือกรูปสลิป แอปอ่าน QR ให้ แล้วกรอกยอดเงิน / หมวด → บันทึก
- **＋ จดรายการ** — จดรายรับ/รายจ่ายที่ไม่มีสลิป
- Android: กด "แชร์" รูปสลิปจากแอปธนาคาร → เลือก **เป๋าตังค์** ได้เลย
- แตะรายการเพื่อดูสลิปหรือลบ

> QR บนสลิปมีแค่ธนาคารผู้โอนและเลขอ้างอิง ไม่มียอดเงิน ยอดจึงต้องกรอกเอง (ถ้าเป็น QR พร้อมเพย์ที่ระบุยอดไว้ แอปจะเติมยอดให้)

---

## ตั้งค่าครั้งแรก (ไม่ต้องใช้ Google Cloud)

### 1. Google Sheet + Apps Script
1. สร้าง Google Sheet ใหม่ ตั้งชื่อเช่น `เป๋าตังค์`
2. เมนู **ส่วนขยาย → Apps Script** → ลบโค้ดเดิม แล้ววางโค้ดจากไฟล์ [`apps-script/Code.gs`](apps-script/Code.gs)
3. แก้บรรทัด `const SECRET = '...'` เป็นข้อความสุ่มยาว ๆ แล้วกดบันทึก 💾
4. **ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่** → ⚙️ เลือก **เว็บแอป**
   - ดำเนินการในฐานะ: **ฉัน**
   - ผู้มีสิทธิ์เข้าถึง: **ทุกคน**
5. กดอนุญาตสิทธิ์ ถ้าขึ้น "Google hasn't verified this app" ให้กด **Advanced → Go to … (unsafe) → Allow** (เป็นสคริปต์ของคุณเอง)
6. คัดลอก **URL ของเว็บแอป** (ลงท้ายด้วย `/exec`)

แท็บ `รายการ` และโฟลเดอร์ `เป๋าตังค์ - สลิป` ใน Drive จะถูกสร้างให้อัตโนมัติตอนใช้งานครั้งแรก

> แก้โค้ดสคริปต์ภายหลัง: Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy (URL เดิมใช้ต่อได้)

### 2. Vercel
1. https://vercel.com/new → Import repo `ms-mook/PaotangMook` → Deploy
2. **Settings → Environment Variables** ใส่:

| ชื่อ | ค่า |
|---|---|
| `APP_PIN` | PIN 4–8 หลัก |
| `AUTH_SECRET` | ข้อความสุ่มยาว ๆ (`openssl rand -hex 32`) |
| `APPS_SCRIPT_URL` | URL เว็บแอปจากข้อ 1.6 |
| `APPS_SCRIPT_SECRET` | ค่าเดียวกับ `SECRET` ในสคริปต์ |

3. **Deployments → Redeploy**

### 3. ตรวจการเชื่อมต่อ
เปิด `https://<โดเมน>/setup` (ใส่ PIN) — ถ้าขึ้น ✅ ครบทุกข้อ พร้อมลิงก์ชีตและโฟลเดอร์สลิป ก็ใช้งานได้เลย 🎉

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

## โครงสร้าง
```
app/page.tsx              หน้าหลัก: สรุปรายเดือน + รายการ
app/login, app/setup      PIN และหน้าตรวจการเชื่อมต่อ
app/api/transactions      อ่าน/เพิ่ม/ลบรายการ + อัปสลิป (ผ่าน Apps Script)
app/api/slip/[id]         แสดงรูปสลิปจาก Drive
apps-script/Code.gs       โค้ดที่วางใน Apps Script ของชีต (เขียน Sheet + Drive)
components/               AddSheet (ฟอร์ม + อ่าน QR), DetailSheet
lib/store.ts              ตัวเรียก Apps Script ฝั่ง server
lib/slipqr.ts             แกะ QR สลิป / พร้อมเพย์
lib/image.ts              ย่อรูป + สแกน QR ในเบราว์เซอร์ (jsQR)
proxy.ts                  ตรวจ session ทุก request
public/sw.js              service worker (offline shell + share target)
```

## หมายเหตุความปลอดภัย
- URL ของ Apps Script เป็นสาธารณะ แต่ทุกคำสั่งต้องมี `SECRET` ที่ตรงกัน ซึ่งเก็บไว้ฝั่ง server (Vercel) เท่านั้น ไม่เคยส่งไปถึงเบราว์เซอร์
- สคริปต์ส่งรูปให้เฉพาะไฟล์ที่อยู่ในโฟลเดอร์สลิปเท่านั้น
- ห้าม commit `.env*` (มีใน `.gitignore` แล้ว) — ค่าลับทั้งหมดอยู่ใน Vercel เท่านั้น
