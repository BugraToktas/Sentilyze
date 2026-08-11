"""
Sentilyze API — v2
==================
Çok boyutlu duygu analizi için hazırlanmış, model-bağımsız FastAPI backend.

Modelden gelen her etiket doğrudan iletilir; artık Olumlu/Olumsuz/Nötr'e
sabit bağımlılık yoktur. Yeni model eklendiğinde sadece ./SentimentAI_Model
klasörü değiştirilir, API kodu değişmez.

Desteklenen model türleri:
  - single-label: pipeline, {"label": "joy", "score": 0.92}
  - multi-label:  pipeline(top_k=None) → [{"label":"joy","score":0.7}, ...]
"""

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import time
import os
from dotenv import load_dotenv

from youtube_fetcher import fetch_comments_from_url, extract_video_id

load_dotenv()

# ---------------------------------------------------------------------------
# Global model değişkeni
# ---------------------------------------------------------------------------
emotion_pipe = None
MAX_TEXT_LENGTH = 512   # Modelin kaldırabileceği maksimum karakter sayısı

# Modelin multi-label destekleyip desteklemediğini başlatmada belirle
MODEL_SUPPORTS_MULTI = False


# ---------------------------------------------------------------------------
# 1. Lifespan — Sunucu açılıp kapanırken çalışacak kod
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup ve shutdown olaylarını yönetir."""
    global emotion_pipe, MODEL_SUPPORTS_MULTI

    # --- STARTUP ---
    print("[BASLATILIYOR] Sentilyze Duygu Modeli RAM'e yukleniyor...")
    try:
        # top_k=None → tüm sınıfların skorlarını döndürür (multi-label)
        # Eski 3-sınıflı model de bu şekilde yüklenir, sonuç 3 eleman olur.
        emotion_pipe = pipeline(
            "text-classification",
            model="./SentimentAI_Model",
            tokenizer="./SentimentAI_Model",
            device=-1,
            top_k=None,  # tüm sınıf skorları isteniyor
        )
        MODEL_SUPPORTS_MULTI = True
        print("[OK] Sentilyze Modeli basariyla yuklendi (multi-label modu).")
    except Exception as e_multi:
        print(f"[UYARI] Multi-label modu hatasi: {e_multi}")
        print("[DENENIYOR] Single-label (eski) mod deneniyor...")
        try:
            emotion_pipe = pipeline(
                "text-classification",
                model="./SentimentAI_Model",
                tokenizer="./SentimentAI_Model",
                device=-1,
            )
            MODEL_SUPPORTS_MULTI = False
            print("[OK] Sentilyze Modeli single-label modda yuklendi.")
        except Exception as e_single:
            print(f"[HATA] Model yuklenirken hata olustu: {e_single}")
            print("Lutfen './SentimentAI_Model' klasorunun main.py ile ayni dizinde oldugu kontrol edin.")

    yield  # Uygulama burada çalışır

    # --- SHUTDOWN ---
    print("[KAPATILIYOR] Sentilyze API kapatiliyor...")
    emotion_pipe = None


# ---------------------------------------------------------------------------
# 2. FastAPI Uygulaması
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Sentilyze API",
    description="Çok Boyutlu Duygu Analizi Platformu — Model Bağımsız",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# 3. CORS Ayarları
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ Prod ortamında frontend URL'iyle değiştir!
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
    max_comments: int = 500
    order: str = "relevance"
    include_replies: bool = False


class YouTubeFetchAndAnalyzeRequest(BaseModel):
    url: str
    max_comments: int = 500
    order: str = "relevance"
    include_replies: bool = False


# ---------------------------------------------------------------------------
# 5. Yardımcı Fonksiyonlar
# ---------------------------------------------------------------------------
def _check_model():
    """Model yüklü değilse 503 hatası fırlat."""
    if emotion_pipe is None:
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


def _parse_model_output(raw_output) -> Dict[str, Any]:
    """
    Model çıktısını normalize eder.

    Desteklenen çıktı formatları:
      - Single-label: {"label": "joy", "score": 0.92}
      - Multi-label:  [{"label":"joy","score":0.7}, {"label":"sadness","score":0.2}, ...]

    Dönen dict:
      {
        "label": str,               # Baskın duygu etiketi
        "confidence": float,        # Baskın etiketin yüzde skoru (0–100)
        "scores": {label: pct, ...} # Tüm sınıfların yüzde skorları
      }
    """
    if isinstance(raw_output, list) and len(raw_output) > 0:
        # multi-label: liste olarak gelir
        if isinstance(raw_output[0], dict) and "label" in raw_output[0]:
            # En yüksek skorluyu baskın olarak seç
            sorted_items = sorted(raw_output, key=lambda x: x["score"], reverse=True)
            dominant = sorted_items[0]
            scores = {
                item["label"]: round(item["score"] * 100, 2)
                for item in sorted_items
            }
            return {
                "label": dominant["label"],
                "confidence": round(dominant["score"] * 100, 2),
                "scores": scores,
            }
        # pipeline bazen [[{...}]] şeklinde iç içe liste döndürür
        if isinstance(raw_output[0], list):
            return _parse_model_output(raw_output[0])

    if isinstance(raw_output, dict) and "label" in raw_output:
        # single-label
        return {
            "label": raw_output["label"],
            "confidence": round(raw_output["score"] * 100, 2),
            "scores": {raw_output["label"]: round(raw_output["score"] * 100, 2)},
        }

    # Tanımsız format
    raise ValueError(f"Model çıktısı beklenmeyen formatta: {type(raw_output)}")


def _analyze_text(text: str) -> Dict[str, Any]:
    """Tek metni analiz eder, normalize edilmiş dict döndürür."""
    raw = emotion_pipe(text)
    # pipeline bazen tek eleman için [[{...}]] veya [{...}] döndürür
    if isinstance(raw, list) and len(raw) == 1:
        return _parse_model_output(raw[0])
    return _parse_model_output(raw)


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


# ---------------------------------------------------------------------------
# 6. Endpoint — Tekil Analiz
# ---------------------------------------------------------------------------
@app.post("/api/v1/analyze", summary="Tek metin duygu analizi")
def analyze_sentiment(request: AnalyzeRequest):
    """
    Verilen tek bir metni analiz eder.

    Dönen `label` modelin belirlediği baskın duygu etiketidir (model bağımsız).
    `scores` sözlüğünde tüm duyguların yüzde skorları yer alır.
    """
    _check_model()
    _check_text(request.text)

    start_time = time.time()

    try:
        result = _analyze_text(request.text)
        process_time = round((time.time() - start_time) * 1000, 2)

        return {
            "status": "success",
            "data": {
                "text":            request.text,
                "label":           result["label"],
                "confidence":      result["confidence"],
                "scores":          result.get("scores", {}),
                "process_time_ms": process_time,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 7. Endpoint — Toplu (Batch) Analiz
# ---------------------------------------------------------------------------
@app.post("/api/v1/analyze/batch", summary="Çoklu metin duygu analizi")
def analyze_sentiment_batch(request: BatchAnalyzeRequest):
    """
    Birden fazla metni tek seferde analiz eder.
    Maksimum 50 metin gönderilebilir.

    Her sonuçta `label`, `confidence` ve `scores` döner.
    """
    _check_model()

    if not request.texts:
        raise HTTPException(status_code=400, detail="Metin listesi boş olamaz.")
    if len(request.texts) > 50:
        raise HTTPException(status_code=400, detail="Tek seferde en fazla 50 metin gönderilebilir.")

    for i, text in enumerate(request.texts):
        try:
            _check_text(text)
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=f"[{i}. metin] {e.detail}")

    start_time = time.time()

    try:
        analyzed = []
        for text in request.texts:
            result = _analyze_text(text)
            analyzed.append({
                "text":       text,
                "label":      result["label"],
                "confidence": result["confidence"],
                "scores":     result.get("scores", {}),
            })

        process_time = round((time.time() - start_time) * 1000, 2)

        return {
            "status":          "success",
            "count":           len(analyzed),
            "process_time_ms": process_time,
            "data":            analyzed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 8. Endpoint — YouTube Yorum Çekici (analiz yok)
# ---------------------------------------------------------------------------
@app.post("/api/v1/fetch/youtube", summary="YouTube videosundan yorum çek")
def fetch_youtube_comments(request: YouTubeFetchRequest):
    """
    Verilen YouTube video URL'sinden yorumları çeker (analiz yapmaz).
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
            "status":         "success",
            "process_time_ms": process_time,
            "video_info":     result["video_info"],
            "fetched_count":  len(result["comments"]),
            "comments":       result["comments"],
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 9. Endpoint — YouTube Yorum Çek + Analiz Et
# ---------------------------------------------------------------------------
@app.post("/api/v1/fetch-and-analyze/youtube", summary="YouTube yorumlarını çek ve analiz et")
def fetch_and_analyze_youtube(request: YouTubeFetchAndAnalyzeRequest):
    """
    YouTube videosundan yorumları çeker ve duygu analizini yapar.

    Dönen `summary.breakdown` sözlüğü dinamiktir:
      - Eski 3-sınıflı model: { "Olumlu": {...}, "Olumsuz": {...}, "Nötr": {...} }
      - Yeni çok-duygu modeli: { "joy": {...}, "sadness": {...}, "anger": {...}, ... }

    Bu sayede frontend yeni modele geçildiğinde otomatik uyum sağlar.
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
            detail="Bu videoda analiz edilecek yorum bulunamadı (yorumlar kapalı olabilir).",
        )

    # 2) Duygu analizini uygula
    fetch_time = round((time.time() - start_time) * 1000, 2)
    analyze_start = time.time()

    analyzed = []
    skipped = 0
    label_counts: Dict[str, int] = {}      # { "joy": 12, "sadness": 5, ... }
    label_score_sums: Dict[str, float] = {} # Ortalama hesabı için

    for meta, text in zip(comments_meta, texts):
        if len(text) > MAX_TEXT_LENGTH:
            skipped += 1
            continue
        try:
            result = _analyze_text(text)
            dominant = result["label"]

            # Sayaçları güncelle
            label_counts[dominant] = label_counts.get(dominant, 0) + 1

            # Tüm skorları topla (ortalama için)
            for lbl, score in result.get("scores", {dominant: result["confidence"]}).items():
                label_score_sums[lbl] = label_score_sums.get(lbl, 0.0) + score

            analyzed.append({
                "text":         text,
                "author":       meta.get("author", ""),
                "like_count":   meta.get("like_count", 0),
                "published_at": meta.get("published_at", ""),
                "label":        dominant,
                "confidence":   result["confidence"],
                "scores":       result.get("scores", {}),
            })
        except Exception:
            skipped += 1

    analyze_time = round((time.time() - analyze_start) * 1000, 2)

    # 3) Özet istatistik — dinamik breakdown (herhangi etiket)
    total = len(analyzed)
    breakdown: Dict[str, Dict] = {}
    for label, count in sorted(label_counts.items(), key=lambda x: -x[1]):
        breakdown[label] = {
            "count":      count,
            "percentage": round((count / total * 100), 1) if total > 0 else 0.0,
        }

    # Ağırlıklı ortalama skorlar
    avg_scores: Dict[str, float] = {}
    if total > 0:
        for lbl, total_score in label_score_sums.items():
            avg_scores[lbl] = round(total_score / total, 2)

    return {
        "status":     "success",
        "video_info": yt_result["video_info"],
        "performance": {
            "fetch_time_ms":   fetch_time,
            "analyze_time_ms": analyze_time,
            "total_time_ms":   round(fetch_time + analyze_time, 2),
        },
        "summary": {
            "total_fetched":  len(texts),
            "total_analyzed": total,
            "skipped":        skipped,
            "breakdown":      breakdown,   # Dinamik — model bağımsız
            "avg_scores":     avg_scores,  # Tüm duyguların ortalama yoğunluğu
        },
        "data": analyzed,
    }


# ---------------------------------------------------------------------------
# 10. Endpoint — Sağlık Kontrolü
# ---------------------------------------------------------------------------
@app.get("/health", summary="Sunucu ve model durumu")
def health_check():
    """API ve modelin çalışıp çalışmadığını kontrol eder."""
    return {
        "status":           "ok",
        "app":              "Sentilyze",
        "version":          "2.0.0",
        "model_loaded":     emotion_pipe is not None,
        "model_multi_label": MODEL_SUPPORTS_MULTI,
        "max_text_length":  MAX_TEXT_LENGTH,
    }


@app.get("/", include_in_schema=False)
def root():
    return {"message": "Sentilyze API is running! Dokümantasyon için /docs adresine gidin."}
