# Landing page ทดสอบตลาด Virtual Office (VAT-ready) + ผู้ช่วย AI

**Demo:** https://suffixworks.github.io/virtual-office-landing/ (GitHub Pages, deploy อัตโนมัติเมื่อ push เข้า `main` ผ่าน `.github/workflows/pages.yml`)

> บน GitHub Pages ไม่มี `/api` ฟอร์มจึงทำงานแบบ demo: ตรวจข้อมูลและแสดงข้อความสำเร็จ แต่ **ไม่บันทึกลีด** และไม่โหลด GA4/Meta Pixel (ตรวจจาก hostname `*.github.io` ใน `main.js`) การเก็บลีดจริงต้อง deploy บน Vercel

หน้าเดียวสำหรับวัด demand ให้คนลงชื่อฟรีและนัดชมสถานที่ **ไม่มีระบบรับเงินหรือมัดจำ**

- Static HTML + CSS + JS (ไม่มี framework, ไม่มี build step) ฟอนต์ self-host
- Vercel Functions 2 ตัว: `/api/lead` (รับฟอร์ม → Google Sheets) และ `/api/config` (ส่ง tracking ID)
- Lighthouse mobile (วัดบนเครื่อง ผ่าน dev server ที่ gzip เหมือน Vercel): Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100

## โครงสร้างไฟล์

```
public/              ไฟล์ที่ deploy (Vercel outputDirectory)
  index.html         หน้า landing + JSON-LD (LocalBusiness, FAQPage)
  privacy.html       นโยบายความเป็นส่วนตัว (โครง + placeholder)
  assets/styles.css  ดีไซน์ทั้งหมด (tokens อยู่ใน :root)
  assets/main.js     เมนู, scroll reveal, ฟอร์ม, cookie consent, tracking
  fonts/             Anuphan + IBM Plex Sans Thai (เฉพาะ subset ไทย/ละติน)
  og-image.png       1200×630 (placeholder)
api/lead.js          ตรวจข้อมูล, กันสแปม, เขียน Sheet
api/config.js        GA4 / Meta Pixel ID จาก env var
apps-script/Code.gs  โค้ด Google Apps Script (doPost + setup)
scripts/dev.mjs      dev server ในเครื่อง
scripts/test-lead.mjs เทสต์ API (mock Sheet)
```

## รันในเครื่อง

```bash
npm run dev     # http://localhost:3000
npm test        # เทสต์ /api/lead
```

ถ้าไม่มี `APPS_SCRIPT_URL` ฟอร์มจะทำงานใน dev mode: ตอบสำเร็จและพิมพ์ข้อมูลลง console โดยไม่บันทึกจริง (บน production จะตอบ error แทน)
ใส่ค่าจริงได้ใน `.env.local` (คัดลอกจาก `.env.example`)

## ตั้งค่า Google Sheets + Apps Script

1. สร้าง Google Sheet ใหม่ → **Extensions > Apps Script**
2. ลบโค้ดเดิม วางเนื้อหา `apps-script/Code.gs` แล้วบันทึก
3. **Project Settings > Script Properties** เพิ่ม `SHARED_SECRET` = สตริงสุ่มยาว ๆ (เช่นจาก `openssl rand -hex 32`)
4. เลือกฟังก์ชัน `setup` แล้วกด **Run** หนึ่งครั้ง (อนุญาตสิทธิ์) จะได้ชีต `Leads` และ `Summary`
   - `Summary` นับลีดทั้งหมดและจำนวนที่ "ต้องการเริ่มใช้ภายใน 1 เดือน" แยกตามแพ็กเกจ (ตัวชี้วัดหลักของ brief)
5. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone** → คัดลอก URL ที่ลงท้าย `/exec`
   - เปิดเป็น Anyone ได้เพราะทุก request ต้องมี `SHARED_SECRET` ตรงกัน
6. ถ้าแก้โค้ดภายหลัง ต้อง **Manage deployments > Edit > New version** URL เดิมจึงจะใช้โค้ดใหม่

คอลัมน์ใน `Leads`: timestamp, name, phone, email, company_status, package, start_timeline, addons, pdpa_consent, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page

## Environment variables (Vercel > Project > Settings > Environment Variables)

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `APPS_SCRIPT_URL` | URL `/exec` ของ Apps Script Web App |
| `APPS_SCRIPT_SECRET` | ค่าเดียวกับ `SHARED_SECRET` ใน Apps Script |
| `GA4_MEASUREMENT_ID` | เช่น `G-XXXXXXX` |
| `META_PIXEL_ID` | Pixel ID ตัวเลข |

ห้าม commit ค่าจริง (`.env.local` อยู่ใน `.gitignore` แล้ว)

## Deploy บน Vercel

1. push โฟลเดอร์นี้ขึ้น Git แล้ว Import เข้า Vercel (Framework Preset: **Other**, ไม่ต้องมี build command; `vercel.json` ตั้ง `outputDirectory: public` ไว้แล้ว)
2. ใส่ env vars ตามตารางด้านบน แล้ว Redeploy
3. ทดสอบส่งฟอร์มจริงบน production 1 ครั้ง: ต้องเห็นแถวใหม่ใน `Leads`
4. ลบแถวทดสอบออกจาก Sheet

## Tracking

GA4 และ Meta Pixel โหลด **หลังผู้ใช้กดยอมรับ cookie banner เท่านั้น** (ผู้ใช้เปลี่ยนใจได้จากลิงก์ "ตั้งค่าคุกกี้" ท้ายหน้า)

| Event | เมื่อไร | Parameters |
|---|---|---|
| `cta_click` | คลิกปุ่ม CTA ใด ๆ | `location`: `header`, `hero_primary`, `hero_secondary`, `package_address`, `package_vat_ready`, `package_vat_ready_ai` |
| `package_select` | คลิกปุ่มในการ์ดแพ็กเกจ หรือเปลี่ยน dropdown | `package`, `location` (`package_card` / `form`) |
| `form_start` | โฟกัสช่องแรกในฟอร์ม (ครั้งเดียว) | |
| `generate_lead` | ส่งฟอร์มสำเร็จ | `package`, `start_timeline`, `addons` (คั่นด้วย comma) |
| Meta `Lead` | ส่งฟอร์มสำเร็จ | `content_name` = package |

ใน GA4 ให้ตั้ง `generate_lead` เป็น Key event และสร้าง custom dimension `package`, `start_timeline`, `location` (event scope)

ลิงก์โฆษณาเลือกแพ็กเกจให้อัตโนมัติได้ด้วย `?package=address|vat-ready|vat-ready-ai` และ UTM จะถูกเก็บตั้งแต่หน้าแรกที่เข้า (เก็บใน sessionStorage) แล้วส่งไปกับฟอร์ม

## กันสแปมและความปลอดภัย

- Honeypot field (`website`) และเช็กเวลากรอก (ส่งเร็วกว่า 1.5 วินาทีถือเป็นบอท) ทั้งสองกรณีตอบสำเร็จแบบเงียบ ๆ แต่ไม่บันทึก
- ตรวจข้อมูลซ้ำฝั่ง server (เบอร์ไทย 10 หลักขึ้นต้น 0, อีเมล, ค่าที่อนุญาตของแต่ละตัวเลือก, ต้องยินยอม PDPA)
- Apps Script กัน formula injection (ค่าที่ขึ้นต้นด้วย `= + - @`) และเก็บเบอร์เป็นข้อความเพื่อไม่ให้ 0 หาย
- ยังไม่มี rate limit ต่อ IP ถ้าโดนสแปมหนักให้เปิด Vercel Firewall rate limiting ที่ `/api/lead`

## Placeholder ที่ต้องแก้ก่อนเปิดจริง

copy ทั้งหน้ามาจาก Content Brief แบบคำต่อคำ ค้นหา placeholder ได้ด้วย `grep -rn "\[" public/index.html public/privacy.html public/assets/main.js`

**`public/index.html`**
- `[ชื่อแบรนด์]`: title, OG, logo, footer, JSON-LD, หัวแชตตัวอย่าง
- `[ย่าน]`: meta description และ og:description
- `[จำนวน]`: badge ใน hero, ห้องประชุมแพ็กเกจ Address, ข้อความใต้หัวข้อฟอร์ม
- `[ย่าน / ถนน]`, `[สถานี BTS/MRT]`: ทำเลใน hero
- `[ราคา]`: 3 แพ็กเกจ + บริการเสริมเบอร์ 02 และรับฝากเก็บเอกสาร
- `[ชื่อพาร์ทเนอร์]`: บรรทัดเล็กใต้บริการเสริม 2 ที่
- `[สรุปนโยบายความเป็นส่วนตัวตาม PDPA: ...]` และ `[จำนวนเงิน]`: ใน FAQ (แก้ใน FAQPage JSON-LD ด้วยให้ตรงกัน)
- `[ชื่อนิติบุคคลผู้ให้บริการ]`, `[ที่อยู่สำนักงาน]`, `[เลข 13 หลัก]`: footer
- LocalBusiness JSON-LD: `[เบอร์โทร]`, `[ที่อยู่สำนักงาน]`, `[ย่าน / เขต]`, `[รหัสไปรษณีย์]`
- แชตตัวอย่างในส่วนผู้ช่วย AI: `[ตัวอย่างข้อความ: ...]` 5 ข้อความ (Content Brief ไม่มีข้อความนี้ จึงเว้นเป็น placeholder) หรือลบ `<figure class="chat">` ออกถ้าไม่ต้องการ
- ภาพประกอบ office แบบ abstract 7 ภาพใน hero (`public/assets/art/*.svg`): เป็นภาพชั่วคราว เมื่อมีรูปพื้นที่จริงให้เปลี่ยน `src` ของ `<img>` ใน `.hero-frames`

**`public/assets/main.js`**
- `[อีเมล / เบอร์โทร]`: ช่องทางติดต่อสำรองในข้อความ error เมื่อส่งฟอร์มไม่สำเร็จ

**`public/privacy.html`**: ทุก `[...]` ควรให้ผู้รู้ด้าน PDPA ตรวจ

**โดเมน**: เปลี่ยน `https://www.example.com` เป็นโดเมนจริงใน `index.html` (canonical, og:url, og:image, JSON-LD), `privacy.html`, `robots.txt`, `sitemap.xml`

**`public/og-image.png`**: placeholder ภาษาอังกฤษ ทำใหม่ขนาด 1200×630

ข้อความที่ไม่ได้มาจาก Content Brief แต่คงไว้เพราะจำเป็นต่อการใช้งาน: ลิงก์ข้ามไปเนื้อหาหลัก (screen reader), "ช่องที่มีเครื่องหมาย * ต้องกรอก", "กำลังส่งข้อมูล...", แถบคุกกี้และลิงก์ "ตั้งค่าคุกกี้"

## Design

Mood & tone อ้างอิง petesena.com: บล็อกสีเต็มความกว้างสลับกัน หัวข้อใหญ่และหนา (Anuphan 600 ถึง 700) layout แบบ editorial มีเลขหมวด 01 ถึง 06 ปุ่ม pill พร้อมลูกศร และเมนูลอยด้านล่าง

ลำดับสีของ section: Hero ดำ → Intro ครีม → ปัญหา ดำ → 01 แพ็กเกจ ครีม → 02 บริการเสริม ดำ → 03 ผู้ช่วย AI เขียว → 04 ขั้นตอน น้ำเงิน → 05 FAQ ดำ → 06 ฟอร์ม ครีม → Footer ดำ

- **Hero**: เต็มจอ หัวข้อจัดกลาง มีภาพประกอบ office แบบ abstract (SVG วาดเองในโทนสีของเว็บ: โต๊ะทำงาน หน้าต่าง ประตูป้ายชื่อ ต้นไม้ ห้องประชุม เอกสาร แชท AI) ลอยรอบ ๆ 7 ภาพบนจอใหญ่ 4 ภาพบนมือถือ เคลื่อนเบา ๆ และบินออกตามการ scroll ภาพเป็นของตกแต่ง ใช้ `alt=""` และ crop ด้วย `object-fit: cover` ให้พอดีกรอบทุกสัดส่วน
- **ปัญหา**: ข้อความ statement ค่อย ๆ สว่างทีละคำตามการ scroll
- **แพ็กเกจ**: การ์ดมีแถบสีด้านบน (ทราย / เขียว / น้ำเงิน) แพ็กเกจแนะนำยกสูงกว่าและมีขอบเขียว
- **บริการเสริม**: การ์ด 3 ใบบนพื้นดำ (เบอร์ 02, รับเอกสาร, รับฝากเก็บเอกสาร)
- **ผู้ช่วย AI**: รายการฟีเจอร์ + กรอบหน้าจอแชตของ AI Agent (ใช้กับ Slack, Discord และ Basecamp ข้อความเป็น placeholder)
- **ขั้นตอน**: timeline แนวนอนบนจอใหญ่ แนวตั้งบนมือถือ
- **ฟอร์ม**: section ครีมเต็มความกว้าง หัวข้อซ้ายติดอยู่ขณะ scroll บนจอใหญ่

**Motion** (`public/assets/motion.js`, ใช้ GSAP + ScrollTrigger + Lenis แบบ self-host ใน `public/assets/vendor/`) ทำตามจังหวะของเว็บ reference:
- smooth scroll ทั้งหน้า และลิงก์ในหน้า (เมนู, ปุ่ม CTA) เลื่อนนุ่มไปยัง section แล้วย้ายโฟกัสให้ผู้ใช้คีย์บอร์ด
- Hero: กรอบภาพค่อย ๆ ปรากฏทีละกรอบแล้วลอยขึ้นลงเบา ๆ เมื่อ scroll กรอบบินออกจากกลางจอและขยายขึ้น ส่วนบรรทัดที่สองของหัวข้อค่อย ๆ ปรากฏ (จอใหญ่ hero ค้างไว้ระหว่าง scroll, มือถือไม่ค้าง)
- ย่อหน้า intro และข้อความ "ตั้งแต่ปี 2569" สว่างขึ้นทีละคำตามการ scroll
- การ์ด รายการ และหัวข้อ ลอยขึ้นมาเมื่อเข้าจอ (ถ้ากระโดดข้ามด้วยลิงก์ # ก็แสดงครบ)
- กรอบแชตเปิดด้วย clip-path และขยับช้ากว่าการ scroll เล็กน้อย
- เนื้อหาของแต่ละ section เลื่อนช้าลงขณะ section ถัดไปเข้ามาทับ และ footer เลื่อนขึ้นมาตอนท้าย

ทั้งหมดปิดเองเมื่อผู้ใช้ตั้ง reduce motion หรือถ้าโหลด library ไม่ได้ (หน้ายังแสดงครบตามปกติ) GSAP ใช้ได้ฟรีตาม GSAP Standard License, Lenis เป็น MIT

สิ่งที่ต่างจาก design tokens ใน brief เดิม:
- พื้นเข้ม `#0B0D0C` แทน `#13221E`, พื้นสว่างเป็นครีม `#F2F0EB` แทน `#F3F5F4`
- ส่วนผู้ช่วย AI เป็นบล็อกเขียว `#0E5A49` แทนพื้น `#E4ECE9` และเพิ่มสีน้ำเงิน `#1A35C4` สำหรับขั้นตอนและแพ็กเกจ VAT-ready + AI
- ปุ่มเป็น pill (โค้งเต็ม) ส่วนการ์ดและช่องกรอกยังโค้ง 12 ถึง 16px
- ฟอนต์ Plex ใช้ 400/500 (ไม่โหลด 600 เพื่อลดขนาด)

ทุกคู่สีผ่าน WCAG AA (Lighthouse accessibility 100) สีทั้งหมดอยู่ที่ `:root` และ class `.theme-dark / .theme-cream / .theme-accent / .theme-blue` ใน `styles.css`

## Definition of done: สถานะ

- [x] Lighthouse mobile ≥ 90 ทุกหมวด (ได้ 100 ทุกหมวดบนเครื่อง; ควรวัดซ้ำบน URL production)
- [x] ใช้งานด้วยคีย์บอร์ดได้, label ผูกกับ input ทุกช่อง, error แจ้งเป็นข้อความและย้ายโฟกัสไปช่องแรกที่ผิด
- [x] 375px เป็นคอลัมน์เดียว ไม่มี horizontal scroll
- [x] เทสต์ API: บันทึก Sheet, validation, honeypot, กรณี Sheet ล่ม (`npm test`, mock)
- [ ] **ทดสอบส่งฟอร์มจริงแล้วข้อมูลเข้า Sheet**: ต้องทำหลังตั้ง Apps Script และ env vars
- ไม่มี LINE ในเว็บแล้ว (ทั้งการแจ้งเตือนทีม ลิงก์ติดต่อ และผู้ช่วย AI ซึ่งใช้ Slack, Discord และ Basecamp แทน) ดูลีดใหม่ใน Sheet
