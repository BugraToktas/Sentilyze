-- =============================================================================
-- TriSential — Migration: analysis_history → analysis_jobs + analysis_items
-- =============================================================================
-- Supabase SQL Editor'de bu dosyadaki adımları sırayla çalıştır.
-- Önce schema.sql'i çalıştır, sonra bu migration'ı.
-- =============================================================================

-- Eski tabloyu kaldır (veri yoksa güvenli)
DROP TABLE IF EXISTS analysis_history;
