# Sentilyze

Çok boyutlu duygu analizi platformu. YouTube video yorumları, metin ve toplu metin analizi için geliştirilmekte olan Emotion AI projesi.

> **"Sentiment" + "Analyze"** — Model bağımsız altyapı ile herhangi bir duygu modeliyle çalışır.

## Teknolojiler

- **Backend:** FastAPI + HuggingFace Transformers
- **Frontend:** Expo (React Native)
- **Veritabanı:** Supabase

## v2 Değişiklikleri

- TriSential → **Sentilyze** yeniden adlandırma
- 3 sabit sınıf (Olumlu/Olumsuz/Nötr) yerine **dinamik duygu sistemi**
- `emotions_summary JSONB` ile herhangi sayıda duygu etiketi desteği
- Yeni model eklendiğinde API ve UI değişmez — sadece `./SentimentAI_Model` klasörü güncellenir

## Durum

🚧 Proje aktif geliştirme aşamasındadır.
