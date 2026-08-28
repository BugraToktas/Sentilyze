# Sentilyze

> **"Sentiment" + "Analyze"** — Türkçe çok boyutlu duygu analizi platformu.

YouTube video yorumlarını, serbest metinleri ve canlı yayın chat mesajlarını gerçek zamanlı olarak analiz ederek beş temel duyguyu (korku, mutluluk, öfke, şaşkınlık, üzüntü) tespit eden mobil uygulama.

---

## Mimari

```
┌─────────────────────────────────────────────────────┐
│                  Expo Uygulaması                    │
│         (iOS / Android / Web — React Native)        │
└────────────┬─────────────────────┬──────────────────┘
             │                     │
             ▼                     ▼
  ┌──────────────────┐   ┌──────────────────────────┐
  │  Strapi v5       │   │  FastAPI (Python)         │
  │  :1337           │   │  :8000                    │
  │                  │   │                           │
  │  • JWT Auth      │   │  • Tekil analiz           │
  │  • Kayıt/Giriş   │   │  • Toplu analiz           │
  │  • Analiz geçmişi│   │  • YouTube yorum çekme    │
  │  • Live session  │   │  • Canlı yayın SSE        │
  └────────┬─────────┘   │  • BERTurk modeli         │
           │             └──────────────────────────┘
           ▼
  ┌──────────────────┐
  │   PostgreSQL     │
  │                  │
  │  • analysis_jobs │
  │  • analysis_items│
  │  • live_sessions │
  └──────────────────┘
```

---

## Özellikler

### Analiz Modları

| Mod | Açıklama |
|---|---|
| **Tekil Analiz** | Tek metin girişi → 5 duygu yüzdesi + baskın duygu |
| **Toplu Analiz** | Çok satırlı metin → her satır ayrı analiz edilir |
| **YouTube Video** | Video URL → yorumlar çekilir, tümü analiz edilir |
| **YouTube Canlı** | Canlı yayın URL → chat mesajları gerçek zamanlı analiz |

### Canlı Yayın Analizi
- YouTube liveChatMessages API ile polling
- Her 10 saniyede bir "bucket" (duygu özeti) oluşturulur
- SSE (Server-Sent Events) ile frontend'e anlık aktarım
- Zaman serisi grafiği — her duygu ayrı çizgi olarak gösterilir

### Geçmiş
- Tüm analizler Strapi üzerinden PostgreSQL'e kaydedilir
- Kullanıcıya özel filtreleme (JWT ile otomatik)
- Analiz edilen yorumlar görüntülenebilir (expandable kart)

---

## AI Modeli

### BERTurk Fine-Tuned
- **Temel model:** `dbmdz/bert-base-turkish-cased`
- **Eğitim verisi:** `nihalenc/turkish-8class-emotion-dataset` — 27.521 örnek
- **Test doğruluğu:** %85.6 (macro F1)

| Duygu | F1 Skoru |
|---|---|
| korku | %95.3 |
| mutluluk | %87.5 |
| şaşkınlık | %83.1 |
| öfke | %81.1 |
| üzüntü | %79.8 |

### Model Güncelleme
Model klasörü değiştirilerek API ve UI kodu değiştirilmeden farklı model kullanılabilir:
```bash
# Sadece bu klasörü güncelle:
backend/sentilyze_model/
  ├── config.json
  ├── model.safetensors
  ├── tokenizer.json
  └── tokenizer_config.json
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil Uygulama | Expo (React Native) — iOS / Android / Web |
| UI | react-native-reanimated, expo-blur, expo-linear-gradient |
| Auth & CRUD | Strapi v5 (Node.js) |
| AI Backend | FastAPI (Python) |
| AI Model | HuggingFace Transformers — BERTurk |
| Veritabanı | PostgreSQL |
| Canlı Akış | SSE (Server-Sent Events) |
| YouTube | YouTube Data API v3 |

---

## Kurulum

### Gereksinimler
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- YouTube Data API v3 anahtarı

### 1. Veritabanı

```sql
CREATE DATABASE sentilyze;
```

### 2. Strapi Backend

```bash
cd strapi-backend
npm install
```

`.env` dosyası oluştur:
```env
HOST=0.0.0.0
PORT=1337
APP_KEYS=<rastgele-string>
API_TOKEN_SALT=<rastgele-string>
ADMIN_JWT_SECRET=<rastgele-string>
TRANSFER_TOKEN_SALT=<rastgele-string>
JWT_SECRET=<rastgele-string>
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=sentilyze
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<şifre>
```

```bash
npm run develop
# http://localhost:1337/admin → İlk admin hesabını oluştur
# Settings → API Tokens → Full Access token oluştur
```

### 3. Python (AI) Backend

```bash
cd backend
pip install fastapi uvicorn transformers torch httpx python-dotenv sse-starlette
```

`.env` dosyası:
```env
YOUTUBE_API_KEY=<youtube-data-api-v3-anahtarı>
```

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
```

`frontend/src/lib/api-client.ts` içinde URL'leri kontrol et:
```ts
const STRAPI_URL = 'http://localhost:1337';
const AI_URL     = 'http://localhost:8000';
```

```bash
npx expo start
```

---

## API Endpoints

### FastAPI (:8000)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/health` | Sistem durumu + model bilgisi |
| POST | `/analyze` | Tekil metin analizi |
| POST | `/analyze/batch` | Toplu metin analizi |
| POST | `/youtube/fetch-and-analyze` | YouTube video analizi |
| POST | `/live/start` | Canlı yayın başlat |
| GET | `/live/{session_id}/stream` | SSE akışı |
| POST | `/live/{session_id}/stop` | Canlı yayın durdur |
| GET | `/live/{session_id}` | Session özeti |

### Strapi (:1337)

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/local/register` | Kayıt |
| POST | `/api/auth/local` | Giriş (JWT döner) |
| GET | `/api/analysis-jobs` | Kullanıcının analiz geçmişi |
| POST | `/api/analysis-jobs` | Yeni analiz kaydet |
| GET | `/api/live-sessions` | Canlı yayın geçmişi |

---

## Proje Yapısı

```
Sentilyze/
├── backend/                   # Python AI Backend
│   ├── main.py                # FastAPI uygulaması
│   ├── livestream.py          # YouTube canlı yayın motoru
│   ├── youtube_fetcher.py     # YouTube yorum çekici
│   └── sentilyze_model/       # BERTurk fine-tuned model
│
├── strapi-backend/            # Node.js Auth & CRUD Backend
│   └── src/api/
│       ├── analysis-job/      # Analiz geçmişi
│       ├── analysis-item/     # Tekil analiz öğeleri
│       └── live-session/      # Canlı yayın oturumları
│
├── frontend/                  # Expo React Native Uygulaması
│   └── src/
│       ├── app/
│       │   ├── (auth)/        # Giriş / Kayıt ekranları
│       │   └── (app)/
│       │       ├── dashboard.tsx   # Ana ekran (analiz + geçmiş)
│       │       └── live.tsx        # Canlı yayın ekranı
│       ├── components/
│       │   ├── ui/            # GlassCard, ProgressRing, MeshBackground...
│       │   └── EmotionLineChart.tsx
│       ├── hooks/
│       │   └── use-live-stream.ts
│       └── constants/
│           └── theme.ts       # Tasarım token'ları
│
└── postgres/                  # Veritabanı şeması
```

---

## Notlar

- CORS `allow_origins=["*"]` olarak ayarlıdır — prodüksiyon için frontend URL'iyle değiştirin.
- YouTube Data API günlük kota limiti vardır (10.000 unit/gün ücretsiz).
- Canlı yayın analizi gerçek zamanlı çalışan YouTube Live Chat gerektiriyor; arşiv videolarda çalışmaz.
