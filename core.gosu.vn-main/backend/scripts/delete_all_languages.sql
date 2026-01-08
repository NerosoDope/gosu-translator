-- Script để xóa tất cả dữ liệu trong bảng languages
-- 
-- Usage:
--   docker-compose exec postgres psql -U core_user -d core_db -f /app/scripts/delete_all_languages.sql
--   hoặc
--   psql -U core_user -d core_db -f scripts/delete_all_languages.sql

BEGIN;

-- Xóa language_pairs trước (để tránh lỗi foreign key constraint)
DELETE FROM language_pairs;

-- Xóa languages
DELETE FROM languages;

COMMIT;

-- Hiển thị kết quả
SELECT 'Đã xóa tất cả dữ liệu trong bảng languages và language_pairs' AS result;
