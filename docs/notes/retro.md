# Retro (cập nhật cuối dự án, Phase 4)

## Số liệu đến hết Phase 1
- Test: 42 (node:test, qua CLI headless thật; 7 test hồi quy từ review độc lập) · dòng proof: 9 · chơi thử GUI: 15 kiểm tra · autopilot thắng 20/20 seed.
- Đêm đầy đủ 18000 tick headless chạy dưới 1 giây (xem REPORT.md §4).

## Bài học tạm thời
- Viết test từ chữ trong contract trước khi code giúp bắt lỗi ngay ở lần chạy đầu (chính lỗi của test).
- Đặt toàn bộ luật chơi trong một module thuần, tất định giúp headless và GUI không bao giờ lệch nhau.

## Nếu làm lại
- (điền ở Phase 4)
