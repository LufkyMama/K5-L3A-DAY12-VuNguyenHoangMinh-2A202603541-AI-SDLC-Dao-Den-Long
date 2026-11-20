# Nhật ký dùng AI

Công cụ: **Claude Code** (model Claude Opus 5.5), một phiên duy nhất cho Phase 1. Harness: [CLAUDE.md](../../CLAUDE.md), hook test-gate, skill `verify`, agent `contract-reviewer`, CI.

## Phase 1

| Bước | Lời nhắc / việc giao cho AI | Ghi chú |
|---|---|---|
| Đọc yêu cầu | Đọc lab board (tab Phase 1) + GUIDE/RUBRIC/SUBMISSION, rút ra contract chính xác (công thức xoay `cam_yaw_deg`, mô hình tick) | Bản tóm tắt tự động bị diễn giải lại, nên trích nguyên văn từ HTML để không sai công thức |
| Thiết kế | Một module luật chơi tất định dùng chung cho headless + GUI; tuning một nguồn | Quyết định ghi trong `phase-1.md` §3 |
| Kiểm chứng trước | Viết test hành vi qua CLI thật, giá trị mong đợi suy ra từ contract | 2 test sai lúc đầu (xem evaluation) |
| Build | sim → validate → headless → test → GUI → autopilot → proof | Commit nhỏ theo từng việc |
| Verify | `npm test`, `npm run proof -- 1`, chụp GUI bằng Chrome headless, xem ảnh | |

### Token / chi phí (ước tính)

| Phase | Token ước tính | Cách tiết kiệm |
|---|---|---|
| 1 | ~250–350k token tổng (input có cache + output); phần lớn là ngữ cảnh đọc tài liệu lab và viết ~1.5k dòng code/test/doc | Đọc yêu cầu một lần và trích đúng phần cần; không dùng subagent; chạy test bằng một lệnh và chỉ in dòng tóm tắt (`grep ℹ`); ảnh chụp chỉ xem những tấm cần |

> Đây là ước tính của agent, không phải số đo. Số thật xem bằng `/cost` trong Claude Code (hoặc trang usage) rồi cập nhật vào bảng.
