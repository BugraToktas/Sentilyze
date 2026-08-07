"""
TriSential – YouTube Yorum Çekici Modülü
=========================================
YouTube Data API v3 kullanarak bir video URL'sinden tüm yorumları çeker.

Desteklenen URL formatları:
  - https://www.youtube.com/watch?v=VIDEO_ID
  - https://youtu.be/VIDEO_ID
  - https://www.youtube.com/shorts/VIDEO_ID
  - https://m.youtube.com/watch?v=VIDEO_ID

Kota notu:
  commentThreads.list → 1 unit/istek
  100 yorum/sayfa → 10.000 unit/gün ≈ 1.000.000 yorum/gün (teorik maksimum)
"""

import re
import os
from typing import Optional
from urllib.parse import urlparse, parse_qs

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


# ---------------------------------------------------------------------------
# YouTube URL'sinden Video ID çıkarma
# ---------------------------------------------------------------------------

# Desteklenen format regex'leri
_YT_PATTERNS = [
    r"(?:v=)([a-zA-Z0-9_-]{11})",          # ?v=VIDEO_ID
    r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",   # youtu.be/VIDEO_ID
    r"(?:shorts/)([a-zA-Z0-9_-]{11})",      # /shorts/VIDEO_ID
    r"(?:embed/)([a-zA-Z0-9_-]{11})",       # /embed/VIDEO_ID
]

def extract_video_id(url: str) -> Optional[str]:
    """
    YouTube URL'sinden 11 karakterlik video ID'yi çıkarır.
    Geçersiz URL ise None döndürür.
    """
    url = url.strip()
    for pattern in _YT_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ---------------------------------------------------------------------------
# YouTube API istemcisi oluşturma
# ---------------------------------------------------------------------------

def build_youtube_client(api_key: str):
    """YouTube Data API v3 istemcisi döndürür."""
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)


# ---------------------------------------------------------------------------
# Video meta bilgisi çekme
# ---------------------------------------------------------------------------

def get_video_info(youtube, video_id: str) -> dict:
    """
    Videonun başlık, kanal adı, toplam yorum sayısı ve yayın tarihini döndürür.
    Quota maliyeti: 1 unit
    """
    response = youtube.videos().list(
        part="snippet,statistics",
        id=video_id
    ).execute()

    items = response.get("items", [])
    if not items:
        raise ValueError(f"Video bulunamadı: {video_id}")

    item = items[0]
    snippet = item.get("snippet", {})
    stats  = item.get("statistics", {})

    return {
        "video_id":      video_id,
        "title":         snippet.get("title", "Başlık bulunamadı"),
        "channel":       snippet.get("channelTitle", ""),
        "published_at":  snippet.get("publishedAt", ""),
        "comment_count": int(stats.get("commentCount", 0)),
        "view_count":    int(stats.get("viewCount", 0)),
        "like_count":    int(stats.get("likeCount", 0)),
    }


# ---------------------------------------------------------------------------
# Yorumları sayfalayarak çekme
# ---------------------------------------------------------------------------

def fetch_all_comments(
    youtube,
    video_id: str,
    max_comments: int = 500,
    order: str = "relevance",   # "relevance" | "time"
    include_replies: bool = False,
) -> list[dict]:
    """
    Bir YouTube videosunun tüm üst-düzey yorumlarını (ve isteğe bağlı
    cevaplarını) çeker. Her sayfa 100 yorum içerir.

    Args:
        youtube:          build_youtube_client() ile oluşturulan istemci
        video_id:         11 karakterlik YouTube video ID
        max_comments:     Çekilecek maksimum yorum sayısı (kota koruması)
        order:            "relevance" (öne çıkan) | "time" (en yeni)
        include_replies:  Alt cevapları da dahil et (kota daha fazla harcar)

    Returns:
        Her biri { text, author, like_count, published_at } içeren liste
    """
    comments = []
    next_page_token = None

    while len(comments) < max_comments:
        batch_size = min(100, max_comments - len(comments))

        try:
            request = youtube.commentThreads().list(
                part="snippet",
                videoId=video_id,
                maxResults=batch_size,
                order=order,
                pageToken=next_page_token,
                textFormat="plainText",  # HTML entity sorunlarını önler
            )
            response = request.execute()
        except HttpError as e:
            error_code = e.resp.status
            if error_code == 403:
                raise PermissionError(
                    "YouTube API kotası doldu veya yorum devre dışı. "
                    "Lütfen Google Cloud Console'dan kotanızı kontrol edin."
                )
            elif error_code == 404:
                raise ValueError(f"Video bulunamadı veya yorumlar kapalı: {video_id}")
            else:
                raise RuntimeError(f"YouTube API hatası [{error_code}]: {e.reason}")

        for item in response.get("items", []):
            top = item["snippet"]["topLevelComment"]["snippet"]
            comments.append({
                "text":         top["textDisplay"],
                "author":       top["authorDisplayName"],
                "like_count":   top.get("likeCount", 0),
                "published_at": top.get("publishedAt", ""),
            })

            # Alt cevapları ekle (isteğe bağlı)
            if include_replies:
                replies = item["snippet"].get("totalReplyCount", 0)
                if replies > 0:
                    reply_items = item.get("replies", {}).get("comments", [])
                    for reply in reply_items:
                        rs = reply["snippet"]
                        comments.append({
                            "text":         rs["textDisplay"],
                            "author":       rs["authorDisplayName"],
                            "like_count":   rs.get("likeCount", 0),
                            "published_at": rs.get("publishedAt", ""),
                            "is_reply":     True,
                        })

        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break  # Tüm yorumlar çekildi

    return comments[:max_comments]


# ---------------------------------------------------------------------------
# Ana yardımcı fonksiyon – URL'den doğrudan çek
# ---------------------------------------------------------------------------

def fetch_comments_from_url(
    url: str,
    api_key: str,
    max_comments: int = 500,
    order: str = "relevance",
    include_replies: bool = False,
) -> dict:
    """
    Tek fonksiyon: URL ver → video bilgisi + yorumlar dönsün.

    Returns:
        {
          video_info: { ... },
          comments:   [ { text, author, like_count, published_at }, ... ],
          texts_only: [ "yorum1", "yorum2", ... ]   # batch analiz için hazır
        }
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError(
            f"Geçerli bir YouTube URL'si girilmedi. "
            f"Örnek: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )

    youtube = build_youtube_client(api_key)

    video_info = get_video_info(youtube, video_id)
    comments   = fetch_all_comments(
        youtube,
        video_id,
        max_comments=max_comments,
        order=order,
        include_replies=include_replies,
    )

    return {
        "video_info": video_info,
        "comments":   comments,
        "texts_only": [c["text"] for c in comments],  # sentiment pipeline için
    }
