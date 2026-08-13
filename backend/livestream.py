"""
Sentilyze — YouTube Live Chat Polling Motoru (v3)
==================================================
pytchat yerine doğrudan YouTube liveChatMessages API kullanır.

Avantajları:
  - %100 async — event loop hiç bloke olmuyor
  - liveChatId doğrudan kullanılıyor
  - pollingIntervalMillis YouTube'un kendisi belirliyor (rate limit uyumlu)
  - Daha güvenilir: 3rd party kütüphane bağımlılığı yok
  - emotion_pipe run_in_executor ile thread pool'da çalışıyor
"""

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, List, Optional, Literal
import httpx


# ---------------------------------------------------------------------------
# Thread pool — emotion_pipe sync çağrısı buradan yapılacak
# ---------------------------------------------------------------------------
_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="sentilyze_live")

# ---------------------------------------------------------------------------
# Veri yapıları
# ---------------------------------------------------------------------------

@dataclass
class DataPoint:
    """10 saniyelik tek bir zaman dilimine ait duygu özeti."""
    bucket_sec: int
    message_count: int
    emotions: Dict[str, float]
    dominant: str
    sample_messages: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class LiveSession:
    session_id: str
    video_id: str
    video_title: str
    channel_name: str
    status: Literal["starting", "running", "stopped", "error"]
    live_chat_id: Optional[str]
    page_token: Optional[str]
    polling_interval_ms: int
    data_points: List[DataPoint]
    started_at: datetime
    total_messages: int
    error_message: Optional[str]
    task: Optional[asyncio.Task]

    def to_summary(self) -> dict:
        pts = [p.to_dict() for p in self.data_points]
        emotion_totals: Dict[str, float] = {}
        counted = 0
        for pt in self.data_points:
            if pt.message_count > 0:
                for lbl, val in pt.emotions.items():
                    emotion_totals[lbl] = emotion_totals.get(lbl, 0) + val
                counted += 1
        avg_emotions = (
            {k: round(v / counted, 1) for k, v in emotion_totals.items()}
            if counted > 0 else {}
        )
        return {
            "session_id":     self.session_id,
            "video_id":       self.video_id,
            "video_title":    self.video_title,
            "channel_name":   self.channel_name,
            "status":         self.status,
            "started_at":     self.started_at.isoformat(),
            "total_messages": self.total_messages,
            "data_points":    pts,
            "avg_emotions":   avg_emotions,
            "error":          self.error_message,
        }


# ---------------------------------------------------------------------------
# Bellek içi session deposu
# ---------------------------------------------------------------------------
SESSIONS: Dict[str, LiveSession] = {}

BUCKET_SECONDS = 10

# ---------------------------------------------------------------------------
# YouTube Data API — Video bilgisi + liveChatId
# ---------------------------------------------------------------------------

async def get_live_chat_id(video_id: str, api_key: str) -> tuple[str, str, str]:
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "liveStreamingDetails,snippet",
        "id":   video_id,
        "key":  api_key,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(url, params=params)
        res.raise_for_status()
        data = res.json()

    if not data.get("items"):
        raise ValueError(f"Video bulunamadı: {video_id}")

    item    = data["items"][0]
    title   = item["snippet"].get("title", "")
    channel = item["snippet"].get("channelTitle", "")
    live    = item.get("liveStreamingDetails", {})
    chat_id = live.get("activeLiveChatId")

    if not chat_id:
        raise ValueError(
            "Bu video şu anda canlı yayında değil veya sohbet kapalı. "
            "Aktif bir YouTube canlı yayın URL'si girin."
        )
    return chat_id, title, channel


# ---------------------------------------------------------------------------
# YouTube liveChatMessages API — Direkt mesaj çekme (async)
# ---------------------------------------------------------------------------

async def fetch_live_chat_messages(
    client: httpx.AsyncClient,
    live_chat_id: str,
    api_key: str,
    page_token: Optional[str] = None,
) -> dict:
    """
    YouTube liveChatMessages.list API'sini çağırır.

    Returns:
        {
            "messages": [{"text": str, "author": str, "timestamp": str}, ...],
            "next_page_token": str | None,
            "polling_interval_ms": int,
        }
    """
    url = "https://www.googleapis.com/youtube/v3/liveChat/messages"
    params: Dict[str, object] = {
        "liveChatId": live_chat_id,
        "part": "snippet,authorDetails",
        "maxResults": 200,
        "key": api_key,
    }
    if page_token:
        params["pageToken"] = page_token

    res = await client.get(url, params=params)

    # Hata kontrolü
    if res.status_code == 403:
        data = res.json()
        error_reason = ""
        if "error" in data:
            errors = data["error"].get("errors", [])
            if errors:
                error_reason = errors[0].get("reason", "")
        if error_reason == "liveChatEnded":
            raise ValueError("Canlı yayın sona erdi (liveChatEnded)")
        elif error_reason == "liveChatDisabled":
            raise ValueError("Canlı sohbet devre dışı (liveChatDisabled)")
        raise ValueError(f"YouTube API 403 hatası: {error_reason or data}")

    res.raise_for_status()
    data = res.json()

    messages = []
    for item in data.get("items", []):
        snippet = item.get("snippet", {})
        author = item.get("authorDetails", {})
        messages.append({
            "text": snippet.get("displayMessage", ""),
            "author": author.get("displayName", ""),
            "timestamp": snippet.get("publishedAt", ""),
        })

    return {
        "messages": messages,
        "next_page_token": data.get("nextPageToken"),
        "polling_interval_ms": data.get("pollingIntervalMillis", 5000),
    }


# ---------------------------------------------------------------------------
# Bucket hesaplaması
# ---------------------------------------------------------------------------

def _bucket_for(msg_timestamp, reference_ts: float) -> int:
    """Mesaj zamanını 10sn'lik bucket'a çevirir. ISO string veya datetime kabul eder."""
    try:
        if isinstance(msg_timestamp, datetime):
            dt = msg_timestamp
        elif isinstance(msg_timestamp, str):
            # YouTube API format: "2026-08-13T15:11:28.000Z"
            dt = datetime.fromisoformat(msg_timestamp.replace("Z", "+00:00"))
        else:
            raise ValueError(f"Beklenmeyen timestamp tipi: {type(msg_timestamp)}")
        elapsed = int(dt.timestamp() - reference_ts)
    except Exception:
        elapsed = int(time.time() - reference_ts)
    elapsed = max(0, elapsed)
    return (elapsed // BUCKET_SECONDS) * BUCKET_SECONDS


def _run_pipe(emotion_pipe, text: str) -> Optional[str]:
    """Synchronous emotion_pipe çağrısı — thread pool'da çalışır."""
    try:
        raw = emotion_pipe(text[:512])
        if isinstance(raw, list) and raw:
            first = raw[0]
            if isinstance(first, list):
                first = first[0]
            return first.get("label", "bilinmiyor")
        if isinstance(raw, dict):
            return raw.get("label", "bilinmiyor")
    except Exception as e:
        print(f"[LIVE][PIPE ERROR] {e}")
    return None


# ---------------------------------------------------------------------------
# Çekirdek analiz döngüsü — YouTube liveChatMessages API polling
# ---------------------------------------------------------------------------

async def run_live_session(
    session_id: str,
    emotion_pipe,
    api_key: str,
) -> None:
    session = SESSIONS.get(session_id)
    if not session:
        return

    session.status = "running"
    reference_ts   = session.started_at.timestamp()
    loop           = asyncio.get_running_loop()

    # bucket_sec → {"label_counts": {label: n}, "samples": [str]}
    bucket_buffer: Dict[int, Dict] = {}

    print(f"[LIVE] Başladı: {session_id} | Video: {session.video_id}")
    print(f"[LIVE] liveChatId: {session.live_chat_id}")

    page_token: Optional[str] = None
    polling_interval_s = 2.0  # İlk polling aralığı
    consecutive_errors = 0
    max_consecutive_errors = 10

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # İlk çağrıda mevcut mesajları al ama sadece page_token'ı kaydet
            # (eski mesajları tekrar analiz etmemek için)
            print(f"[LIVE] İlk sayfa alınıyor (mevcut mesajlar atlanacak)...")
            try:
                initial = await fetch_live_chat_messages(
                    client, session.live_chat_id, api_key, page_token
                )
                page_token = initial["next_page_token"]
                polling_interval_s = max(initial["polling_interval_ms"] / 1000.0, 1.0)
                skipped = len(initial["messages"])
                print(f"[LIVE] {skipped} eski mesaj atlandı, polling aralığı: {polling_interval_s}s")
            except Exception as e:
                print(f"[LIVE] İlk sayfa hatası: {type(e).__name__}: {e}")
                # İlk hatada bile devam et

            # ── Ana polling döngüsü ──
            while session.status == "running":
                await asyncio.sleep(polling_interval_s)

                if session.status != "running":
                    break

                # YouTube liveChatMessages API çağrısı (async — bloke olmaz)
                try:
                    result = await fetch_live_chat_messages(
                        client, session.live_chat_id, api_key, page_token
                    )
                    consecutive_errors = 0
                except ValueError as e:
                    error_msg = str(e)
                    print(f"[LIVE] Chat hatası: {error_msg}")
                    if "liveChatEnded" in error_msg:
                        print(f"[LIVE] Yayın sona erdi: {session_id}")
                        session.status = "stopped"
                        break
                    elif "liveChatDisabled" in error_msg:
                        session.status = "error"
                        session.error_message = "Canlı sohbet devre dışı bırakıldı"
                        break
                    consecutive_errors += 1
                    if consecutive_errors >= max_consecutive_errors:
                        session.status = "error"
                        session.error_message = f"Çok fazla ardışık hata: {error_msg}"
                        break
                    continue
                except Exception as e:
                    print(f"[LIVE] API hatası: {type(e).__name__}: {e}")
                    consecutive_errors += 1
                    if consecutive_errors >= max_consecutive_errors:
                        session.status = "error"
                        session.error_message = f"API hatası: {e}"
                        break
                    await asyncio.sleep(2)
                    continue

                # Polling aralığını YouTube'un söylediği değere güncelle
                page_token = result["next_page_token"]
                polling_interval_s = max(result["polling_interval_ms"] / 1000.0, 1.0)

                new_messages = result["messages"]
                if not new_messages:
                    continue

                print(f"[LIVE] {len(new_messages)} yeni mesaj geldi (polling: {polling_interval_s}s)")

                # Her mesajı analiz et
                for msg in new_messages:
                    text = msg["text"]
                    if not text or len(text.strip()) < 2:
                        continue

                    timestamp_str = msg["timestamp"]
                    b_sec = _bucket_for(timestamp_str, reference_ts)

                    # Thread pool'da model çalıştır — event loop bloke olmaz
                    try:
                        label = await loop.run_in_executor(
                            _EXECUTOR, _run_pipe, emotion_pipe, text
                        )
                    except Exception as e:
                        print(f"[LIVE][EXECUTOR ERROR] {type(e).__name__}: {e}")
                        continue

                    if label is None:
                        continue

                    session.total_messages += 1

                    # Bucket'a ekle
                    if b_sec not in bucket_buffer:
                        bucket_buffer[b_sec] = {"label_counts": {}, "samples": []}
                    b = bucket_buffer[b_sec]
                    b["label_counts"][label] = b["label_counts"].get(label, 0) + 1
                    if len(b["samples"]) < 3:
                        b["samples"].append(text[:80])

                    print(f"[LIVE] t={b_sec}s -> {label} | Toplam: {session.total_messages}")

                # Bucket'ları DataPoint'e çevir ve güncelle
                for b_sec, b_data in sorted(bucket_buffer.items()):
                    counts = b_data["label_counts"]
                    if not counts:
                        continue
                    total    = sum(counts.values())
                    emotions = {k: round(v / total * 100, 1) for k, v in counts.items()}
                    dominant = max(counts, key=counts.get)
                    samples  = b_data["samples"]

                    existing = next(
                        (dp for dp in session.data_points if dp.bucket_sec == b_sec),
                        None
                    )
                    if existing:
                        existing.message_count = total
                        existing.emotions      = emotions
                        existing.dominant      = dominant
                        existing.sample_messages = samples
                    else:
                        session.data_points.append(DataPoint(
                            bucket_sec=b_sec,
                            message_count=total,
                            emotions=emotions,
                            dominant=dominant,
                            sample_messages=samples,
                        ))
                        session.data_points.sort(key=lambda x: x.bucket_sec)

        # while döngüsünden çıktıktan sonra
        if session.status == "running":
            session.status = "stopped"

    except asyncio.CancelledError:
        print(f"[LIVE] Durduruldu: {session_id}")
        session.status = "stopped"
    except Exception as e:
        print(f"[LIVE] Beklenmeyen hata ({session_id}): {e}")
        import traceback
        traceback.print_exc()
        session.status = "error"
        session.error_message = str(e)


# ---------------------------------------------------------------------------
# SSE Jeneratörü
# ---------------------------------------------------------------------------

async def sse_stream(session_id: str) -> AsyncGenerator[str, None]:
    import json

    session = SESSIONS.get(session_id)
    if not session:
        yield f"event: error\ndata: {json.dumps({'msg': 'Session bulunamadı'})}\n\n"
        return

    # Tüm DataPoint'lerin versiyonunu takip et (bucket_sec → message_count)
    last_snapshot: Dict[int, int] = {}

    yield f"event: status\ndata: {json.dumps({'status': session.status, 'session_id': session_id})}\n\n"

    try:
        while True:
            # Yeni veya güncellenen DataPoint var mı?
            changed = False
            for dp in session.data_points:
                prev_count = last_snapshot.get(dp.bucket_sec, -1)
                if dp.message_count != prev_count:
                    payload = json.dumps(dp.to_dict(), ensure_ascii=False)
                    yield f"event: datapoint\ndata: {payload}\n\n"
                    last_snapshot[dp.bucket_sec] = dp.message_count
                    changed = True

            if session.status in ("stopped", "error"):
                summary = json.dumps(session.to_summary(), ensure_ascii=False)
                yield f"event: ended\ndata: {summary}\n\n"
                break

            yield f": heartbeat\n\n"
            await asyncio.sleep(2)

    except asyncio.CancelledError:
        pass

# ---------------------------------------------------------------------------
# Session yönetim fonksiyonları
# ---------------------------------------------------------------------------

def create_session(video_id: str, video_title: str, channel_name: str, live_chat_id: str) -> str:
    sid = str(uuid.uuid4())
    SESSIONS[sid] = LiveSession(
        session_id=sid,
        video_id=video_id,
        video_title=video_title,
        channel_name=channel_name,
        status="starting",
        live_chat_id=live_chat_id,
        page_token=None,
        polling_interval_ms=5000,
        data_points=[],
        started_at=datetime.now(timezone.utc),
        total_messages=0,
        error_message=None,
        task=None,
    )
    return sid


def stop_session(session_id: str) -> bool:
    session = SESSIONS.get(session_id)
    if not session:
        return False
    session.status = "stopped"
    if session.task and not session.task.done():
        session.task.cancel()
    return True


def cleanup_old_sessions(max_age_hours: int = 6) -> int:
    now = datetime.now(timezone.utc)
    to_delete = []
    for sid, sess in SESSIONS.items():
        if sess.status in ("stopped", "error"):
            age = (now - sess.started_at).total_seconds() / 3600
            if age > max_age_hours:
                to_delete.append(sid)
    for sid in to_delete:
        del SESSIONS[sid]
    return len(to_delete)
