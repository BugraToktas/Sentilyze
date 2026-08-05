from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
import time

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
    print("🚀 TriSential Yapay Zeka Modeli RAM'e yükleniyor...")
    try:
        # device=-1 → CPU. Nvidia GPU varsa device=0 yap.
        sentiment_pipe = pipeline(
            "text-classification",
            model="./SentimentAI_Model",
            tokenizer="./SentimentAI_Model",
            device=-1,
        )
        print("✅ TriSential Modeli başarıyla yüklendi ve hazır!")
    except Exception as e:
        print(f"❌ Model yüklenirken hata oluştu: {e}")
        print("Lütfen './SentimentAI_Model' klasörünün main.py ile aynı dizinde olduğundan emin olun.")

    yield  # Uygulama burada çalışır

    # --- SHUTDOWN ---
    print("🛑 TriSential API kapatılıyor...")
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
# 8. Endpoint – Sağlık Kontrolü
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
