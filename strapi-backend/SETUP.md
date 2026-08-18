# Strapi Backend — Kurulum ve Yapılandırma Rehberi

## Gereksinimler

- Node.js 18+
- PostgreSQL 14+ (çalışıyor olması gerekir)
- npm

## Kurulum

Strapi `strapi-backend/` klasörüne kurulmuştur.

```bash
cd strapi-backend
npm run develop    # Development modunda başlat (http://localhost:1337)
```

İlk çalıştırmada `http://localhost:1337/admin` adresine giderek
admin hesabı oluştur.

## Veritabanı Yapılandırması

`strapi-backend/config/database.ts` dosyası PostgreSQL'e bağlanacak şekilde
yapılandırılmıştır. Gerekirse aşağıdaki env değişkenlerini `.env` dosyasına ekle:

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=sentilyze
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false
```

## Content Types (Tablolar)

Strapi Admin Panel'inde **Content-Type Builder** → **Create new collection type** ile şu tablolar oluşturulmalıdır:

### 1. Analysis Job

| Alan | Tip | Notlar |
|------|-----|--------|
| job_type | Enumeration | manual, batch, youtube, ecommerce, gmaps |
| status | Enumeration | pending, processing, completed, failed |
| total_analyzed | Integer | |
| total_skipped | Integer | |
| positive_count | Integer | |
| negative_count | Integer | |
| neutral_count | Integer | |
| emotions_summary | JSON | Dinamik duygu sayımı |
| youtube_url | Text | |
| youtube_video_id | Short text | |
| youtube_video_title | Text | |
| youtube_channel_name | Text | |
| youtube_view_count | Big integer | |
| fetch_time_ms | Decimal | |
| analyze_time_ms | Decimal | |
| total_time_ms | Decimal | |
| ai_summary | Long text | |

### 2. Analysis Item

| Alan | Tip | Notlar |
|------|-----|--------|
| analyzed_text | Long text | Required |
| sentiment_label | Short text | Required |
| confidence_score | Decimal | Required |
| process_time_ms | Decimal | |
| emotion_scores | JSON | |
| source_category | Enumeration | ecommerce, location, other |
| youtube_author | Short text | |
| youtube_like_count | Integer | |
| youtube_published_at | Datetime | |
| analysis_job | Relation | Many-to-One → Analysis Job |

### 3. Live Session

| Alan | Tip | Notlar |
|------|-----|--------|
| platform | Enumeration | youtube, twitch, kick |
| video_id | Short text | |
| video_title | Text | |
| channel_name | Short text | |
| stream_url | Text | |
| total_messages | Integer | |
| total_buckets | Integer | |
| peak_emotion | Short text | |
| duration_secs | Integer | |
| emotions_timeline | JSON | DataPoint dizisi |
| started_at | Datetime | |
| ended_at | Datetime | |

## API İzinleri

Strapi Admin Panel → **Settings** → **Users & Permissions** → **Roles**:

### Authenticated Role:
- Analysis Job: find, findOne, create
- Analysis Item: find, findOne, create
- Live Session: find, findOne, create

### Public Role:
- Hiçbir şeye erişim yok (tüm endpointler auth gerektirir)

## Frontend Ortam Değişkenleri

`frontend/.env` dosyasında:

```env
EXPO_PUBLIC_STRAPI_URL=http://localhost:1337
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

## Python Model Backend

`backend/` klasöründeki FastAPI + duygu analizi modeli **değişmeden** çalışmaya devam eder.
Strapi sadece auth + CRUD katmanı; duygu modeli hâlâ Python'dadır.

## Mimari Özet

```
[Expo App] ──┬──→ [Strapi :1337]  ──→ [PostgreSQL :5432]
             └──→ [FastAPI :8000]  ──→ [Duygu Modeli]
```
