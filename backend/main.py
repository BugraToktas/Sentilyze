from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
import time
import os
from dotenv import load_dotenv

from youtube_fetcher import fetch_comments_from_url, extract_video_id

# .env dosyasını yükle (varsa)
load_dotenv()

# ---------------------------------------------------------------------------
# Global model değişkeni
# ---------------------------------------------------------------------------
sentiment_pipe = None
MAX_TEXT_LENGTH = 512  # Modelin kaldırabileceği maksimum karakter sayısı

# ---------------------------------------------------------------------------
# 1. Lifespan – Sunucu açılıp kapanırken çalışacak kod (modern yöntem)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup ve shutdown olaylarını yönetir."""
    global sentiment_pipe

    # --- STARTUP ---
    print("[BASLATILIYOR] TriSential Yapay Zeka Modeli RAM'e yukleniyor...")
    try:
        # device=-1 → CPU. Nvidia GPU varsa device=0 yap.
        sentiment_pipe = pipeline(
            "text-classification",
            model="./SentimentAI_Model",
            tokenizer="./SentimentAI_Model",
            device=-1,
        )
        print("[OK] TriSential Modeli basariyla yuklendi ve hazir!")
    except Exception as e:
        print(f"[HATA] Model yuklenirken hata olustu: {e}")
        print("Lutfen './SentimentAI_Model' klasorunun main.py ile ayni dizinde oldugu kontrol edin.")

    yield  # Uygulama burada çalışır

    # --- SHUTDOWN ---
    print("[KAPATILIYOR] TriSential API kapatiliyor...")
    sentiment_pipe = None


# ---------------------------------------------------------------------------
# 2. FastAPI Uygulaması
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TriSential API",
    description="E-Ticaret ve Mekan Yorumları İçin Gelişmiş Türkçe Duygu Analizi Modeli",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# 3. CORS Ayarları
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ Prod ortamında bunu frontend URL'iyle değiştir!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# 4. İstek (Request) Şemaları
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    text: str

class BatchAnalyzeRequest(BaseModel):
    texts: List[str]


class YouTubeFetchRequest(BaseModel):
    url: str
    max_comments: int = 500        # Çekilecek maksimum yorum sayısı (kota koruması)
    order: str = "relevance"       # "relevance" | "time"
    include_replies: bool = False  # Alt cevapları da dahil et


class YouTubeFetchAndAnalyzeRequest(BaseModel):
    url: str
    max_comments: int = 500
    order: str = "relevance"
    include_replies: bool = False


# ---------------------------------------------------------------------------
# 5. Yardımcı Fonksiyon – Model null ve metin kontrolü
# ---------------------------------------------------------------------------
def _check_model():
    """Model yüklü değilse 503 hatası fırlat."""
    if sentiment_pipe is None:
        raise HTTPException(
            status_code=503,
            detail="Model henüz yüklenmedi veya yüklenirken hata oluştu. Sunucu loglarını kontrol edin.",
        )

def _check_text(text: str):
    """Boş veya çok uzun metni reddet."""
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Lütfen analiz edilecek bir metin gönderin.")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Metin çok uzun. Maksimum {MAX_TEXT_LENGTH} karakter kabul edilmektedir.",
        )


# ---------------------------------------------------------------------------
# 6. Endpoint – Tekil Analiz
# ---------------------------------------------------------------------------
@app.post("/api/v1/analyze", summary="Tek metin duygu analizi")
def analyze_sentiment(request: AnalyzeRequest):
    """
    Verilen tek bir metni analiz eder ve duygu etiketini (Olumlu / Olumsuz / Nötr)
    güven skoru ile birlikte döndürür.
    """
    _check_model()
    _check_text(request.text)

    start_time = time.time()

    try:
        result = sentiment_pipe(request.text)[0]
        process_time = round((time.time() - start_time) * 1000, 2)

        return {
            "status": "success",
            "data": {
                "text": request.text,
                "label": result["label"],       # Olumlu, Olumsuz veya Nötr
                "confidence": round(result["score"] * 100, 2),
                "process_time_ms": process_time,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 7. Endpoint – Toplu (Batch) Analiz
# ---------------------------------------------------------------------------
@app.post("/api/v1/analyze/batch", summary="Çoklu metin duygu analizi")
def analyze_sentiment_batch(request: BatchAnalyzeRequest):
    """
    Birden fazla metni tek seferde analiz eder.
    Maksimum 50 metin gönderilebilir.
    """
    _check_model()

    if not request.texts:
        raise HTTPException(status_code=400, detail="Metin listesi boş olamaz.")
    if len(request.texts) > 50:
        raise HTTPException(status_code=400, detail="Tek seferde en fazla 50 metin gönderilebilir.")

    # Her metni doğrula
    for i, text in enumerate(request.texts):
        try:
            _check_text(text)
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=f"[{i}. metin] {e.detail}")

    start_time = time.time()

    try:
        results = sentiment_pipe(request.texts)
        process_time = round((time.time() - start_time) * 1000, 2)

        analyzed = [
            {
                "text": text,
                "label": res["label"],
                "confidence": round(res["score"] * 100, 2),
            }
            for text, res in zip(request.texts, results)
        ]

        return {
            "status": "success",
            "count": len(analyzed),
            "process_time_ms": process_time,
            "data": analyzed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 8. Endpoint – YouTube Yorum Çekici
# ---------------------------------------------------------------------------

def _get_youtube_api_key() -> str:
    """YOUTUBE_API_KEY ortam değişkenini döndürür, yoksa 503 fırlatır."""
    key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "YOUTUBE_API_KEY ortam değişkeni bulunamadı. "
                "Lütfen backend/.env dosyasına YOUTUBE_API_KEY=... ekleyin. "
                "Ücretsiz anahtar: https://console.cloud.google.com"
            ),
        )
    return key


@app.post("/api/v1/fetch/youtube", summary="YouTube videosundan yorum çek")
def fetch_youtube_comments(request: YouTubeFetchRequest):
    """
    Verilen YouTube video URL'sinden yorumları çeker.

    Desteklenen URL formatları:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID

    max_comments: Çekilecek maksimum yorum sayısı (varsayılan 500).
    order: "relevance" (öne çıkan) veya "time" (en yeni).
    include_replies: Alt cevapları da dahil et (varsayılan False).
    """
    api_key = _get_youtube_api_key()

    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir YouTube URL'si girin.")

    if request.order not in ("relevance", "time"):
        raise HTTPException(status_code=400, detail="order değeri 'relevance' veya 'time' olmalıdır.")

    if not (1 <= request.max_comments <= 2000):
        raise HTTPException(status_code=400, detail="max_comments 1 ile 2000 arasında olmalıdır.")

    start_time = time.time()

    try:
        result = fetch_comments_from_url(
            url=request.url,
            api_key=api_key,
            max_comments=request.max_comments,
            order=request.order,
            include_replies=request.include_replies,
        )
        process_time = round((time.time() - start_time) * 1000, 2)

        return {
            "status": "success",
            "process_time_ms": process_time,
            "video_info": result["video_info"],
            "fetched_count": len(result["comments"]),
            "comments": result["comments"],
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/fetch-and-analyze/youtube", summary="YouTube yorumlarını çek ve analiz et")
def fetch_and_analyze_youtube(request: YouTubeFetchAndAnalyzeRequest):
    """
    YouTube videosundan yorumları çeker ve doğrudan duygu analizi yapar.
    Tek adımda hem yorum çekme hem de TriSential analizi gerçekleştirir.

    Dönüş değerinde:
    - video_info: Video meta bilgileri
    - summary: Genel istatistik (Olumlu/Olumsuz/Nötr dağılımı ve yüzdeleri)
    - data: Her yorumun analiz sonucu
    """
    _check_model()
    api_key = _get_youtube_api_key()

    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir YouTube URL'si girin.")

    if request.order not in ("relevance", "time"):
        raise HTTPException(status_code=400, detail="order değeri 'relevance' veya 'time' olmalıdır.")

    if not (1 <= request.max_comments <= 2000):
        raise HTTPException(status_code=400, detail="max_comments 1 ile 2000 arasında olmalıdır.")

    start_time = time.time()

    # 1) YouTube'dan yorumları çek
    try:
        yt_result = fetch_comments_from_url(
            url=request.url,
            api_key=api_key,
            max_comments=request.max_comments,
            order=request.order,
            include_replies=request.include_replies,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YouTube çekim hatası: {e}")

    texts = yt_result["texts_only"]
    comments_meta = yt_result["comments"]

    if not texts:
        raise HTTPException(
            status_code=404,
            detail="Bu videoda analiz edilecek yorum bulunamadı (yorumlar kapalı olabilir)."
        )

    # 2) Sentiment analizini MAX_TEXT_LENGTH'e uyan metinlere uygula
    fetch_time = round((time.time() - start_time) * 1000, 2)
    analyze_start = time.time()

    analyzed = []
    skipped = 0
    for meta, text in zip(comments_meta, texts):
        if len(text) > MAX_TEXT_LENGTH:
            skipped += 1
            continue
        try:
            result = sentiment_pipe(text)[0]
            analyzed.append({
                "text":         text,
                "author":       meta.get("author", ""),
                "like_count":   meta.get("like_count", 0),
                "published_at": meta.get("published_at", ""),
                "label":        result["label"],
                "confidence":   round(result["score"] * 100, 2),
            })
        except Exception:
            skipped += 1

    analyze_time = round((time.time() - analyze_start) * 1000, 2)

    # 3) Özet istatistik hesapla
    # Model bazı durumlarda "Notr" (ASCII), bazı durumlarda "Nötr" döndürebilir.
    # Normalize ediyoruz: her ikisi de "Nötr" olarak sayılır.
    LABEL_MAP = {
        "Olumlu": "Olumlu",
        "Olumsuz": "Olumsuz",
        "Nötr": "Nötr",
        "Notr": "Nötr",   # ASCII fallback
    }

    total = len(analyzed)
    counts = {"Olumlu": 0, "Olumsuz": 0, "Nötr": 0}
    for item in analyzed:
        raw_label = item["label"]
        normalized = LABEL_MAP.get(raw_label, raw_label)
        item["label"] = normalized   # response'da da normalize et
        if normalized in counts:
            counts[normalized] += 1

    breakdown = {}
    for label, count in counts.items():
        breakdown[label] = {
            "count": count,
            "percentage": round((count / total * 100), 1) if total > 0 else 0.0,
        }

    return {
        "status": "success",
        "video_info": yt_result["video_info"],
        "performance": {
            "fetch_time_ms":   fetch_time,
            "analyze_time_ms": analyze_time,
            "total_time_ms":   round(fetch_time + analyze_time, 2),
        },
        "summary": {
            "total_fetched":   len(texts),
            "total_analyzed":  total,
            "skipped":         skipped,
            "breakdown":       breakdown,
        },
        "data": analyzed,
    }


# ---------------------------------------------------------------------------
# 9. Endpoint – Sağlık Kontrolü
# ---------------------------------------------------------------------------
@app.get("/health", summary="Sunucu ve model durumu")
def health_check():
    """API ve modelin çalışıp çalışmadığını kontrol eder."""
    return {
        "status": "ok",
        "model_loaded": sentiment_pipe is not None,
        "max_text_length": MAX_TEXT_LENGTH,
        "version": "1.0.0",
    }

@app.get("/", include_in_schema=False)
def root():
    return {"message": "TriSential API is running! Dokümantasyon için /docs adresine gidin."}
