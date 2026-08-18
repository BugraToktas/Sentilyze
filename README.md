# Sentilyze

Çok boyutlu duygu analizi platformu. YouTube video yorumları, metin ve toplu metin analizi için geliştirilmekte olan Emotion AI projesi.

> **"Sentiment" + "Analyze"** — Model bağımsız altyapı ile herhangi bir duygu modeliyle çalışır.

## Teknolojiler

- **AI Backend:** Python (FastAPI + HuggingFace Transformers) — Duygu analizi modeli
- **App Backend:** Node.js (Strapi v5) — Auth, CRUD API, Yönetim Paneli
- **Frontend:** Expo (React Native)
- **Veritabanı:** PostgreSQL

## Mimari

```
[Expo App]
   ├── Auth / Kayıt / Geçmiş → Strapi (Node.js) :1337 → PostgreSQL
   └── Duygu Analizi          → FastAPI (Python)  :8000 → AI Modeli
```

## v3 Değişiklikleri — Supabase → PostgreSQL + Strapi

> **Not:** Bu versiyon Supabase'den tamamen bağımsız çalışır.

- **Supabase kaldırıldı** — Auth ve veritabanı Strapi + PostgreSQL'e taşındı
- **Strapi v5 eklendi** (`strapi-backend/`) — JWT auth, REST API, Admin Panel
- `@supabase/supabase-js` bağımlılığı frontend'den kaldırıldı
- Google OAuth geçici olarak kaldırıldı (ileride Strapi providers ile eklenebilir)
- Yeni API istemcisi: `frontend/src/lib/api-client.ts`
- PostgreSQL şeması: `postgres/schema.sql`

### Supabase'li eski versiyona ulaşmak için

Eski Supabase entegrasyonlu versiyon Git geçmişinde korunmaktadır:

```bash
# Supabase'li eski versiyonu görmek için
git log --oneline          # eski commit hash'ini bul
git checkout <commit-hash> # o versiyona geç

# Ya da direkt o versiyondaki bir dosyaya bakmak için
git show main~1:frontend/src/lib/supabase.ts
```

## v2 Değişiklikleri

- TriSential → **Sentilyze** yeniden adlandırma
- 3 sabit sınıf (Olumlu/Olumsuz/Nötr) yerine **dinamik duygu sistemi**
- `emotions_summary JSONB` ile herhangi sayıda duygu etiketi desteği
- Yeni model eklendiğinde API ve UI değişmez — sadece `./SentimentAI_Model` klasörü güncellenir

## Kurulum

### 1. PostgreSQL

```sql
CREATE DATABASE sentilyze;
```

### 2. Strapi Backend

```bash
cd strapi-backend
npm run develop
# http://localhost:1337/admin → Admin hesabı oluştur
```

### 3. Python Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Frontend

```bash
cd frontend
npm install
npx expo start
```

## Durum

🚧 Proje aktif geliştirme aşamasındadır.
