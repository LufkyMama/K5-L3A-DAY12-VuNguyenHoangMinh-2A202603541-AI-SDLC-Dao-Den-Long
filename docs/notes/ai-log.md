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
| Chơi thử GUI | "Run the game for me to check" → agent viết driver CDP chơi bằng phím/chuột thật, sau đó đưa vào repo thành `npm run playtest` | Bắt được một kiểm tra luôn-đạt trong chính driver (xem evaluation) |

## Phase 2

| Bước | Việc | Ghi chú |
|---|---|---|
| Yêu cầu | Chủ repo: "không có lab coach, làm theo từng quy trình" → agent tự viết Ticket-02 (ghi rõ là tự đặt) | Có CR-1 để thực hành xử lý thay đổi yêu cầu |
| Test trước | `tests/phase2.test.js` viết trước code (8 test đỏ lúc đầu) | |
| Build | tuning/NIGHTS → sim → validate/CLI → GUI → autopilot/proof/playtest | 5 commit nhỏ |
| Review | agent `contract-reviewer` (~138k token) | Không có lỗi code; 6 góp ý về test yếu đã sửa |

## Phase 3

| Bước | Việc | Ghi chú |
|---|---|---|
| Yêu cầu | Ticket-03 tự đặt, lấy ý từ chính contract (`dash`, `sim_tick` khác `tick`) | |
| Test trước | `tests/phase3.test.js` (9 test đỏ lúc đầu) | |
| Build | sim (pause/dash) → CLI → GUI → regress tool → proof/playtest | 4 commit |
| Review | `contract-reviewer` (~172k token, có thử cố ý gây lỗi cho regress) | 0 lỗi code; 4 góp ý đã sửa |

## Phase 4

| Bước | Việc | Ghi chú |
|---|---|---|
| Yêu cầu | Ticket-04 tự đặt theo README lab (hoàn thiện, đo hiệu năng, phát hành) | |
| Test trước | `tests/phase4.test.js` (đỏ vì chưa có module) | |
| Build | invariants → fuzz → bench → build/zip → GUI kỷ lục + chiến dịch → playtest bản build → video | Phiên bị ngắt một lần, nhờ commit WIP và ghi chú bộ nhớ nên làm tiếp được |
| Review | `contract-reviewer` (~218k token, có cài lỗi vào sim trong bản sao để thử fuzz) | 0 lỗi chức năng; bộ kiểm bất biến được bổ sung nhiều |
| Video | Không có ffmpeg → quay bằng Chrome có cửa sổ đặt ngoài màn hình + MediaRecorder | 3 lần quay mới đúng (xem evaluation) |

### Token / chi phí (ước tính)

| Phase | Token ước tính | Cách tiết kiệm |
|---|---|---|
| 1 | ~450–550k token tổng (kể cả chơi thử GUI và ~90k của agent review) (input có cache + output); phần lớn là ngữ cảnh đọc tài liệu lab và viết ~1.5k dòng code/test/doc | Đọc yêu cầu một lần và trích đúng phần cần; chỉ dùng 1 subagent (review độc lập, ~90k token); chạy test bằng một lệnh và chỉ in dòng tóm tắt (`grep ℹ`); ảnh chụp chỉ xem những tấm cần |

| 2 | ~250–300k (gồm ~138k của agent review) | Viết ticket + test trước để agent code đúng ngay; chỉ in dòng tóm tắt test; reviewer chỉ xem phần thay đổi |
| 3 | ~250k (gồm ~172k của agent review) | Review là phần tốn nhất; phase sau giới hạn reviewer vào phần thay đổi |
| 4 | ~400–500k (gồm ~218k của agent review và 3 lần quay/kiểm video) | Review và video là phần tốn nhất; lẽ ra nên kiểm khung hình của video ngay sau lần quay đầu |
| **Tổng** | **~1.6–1.8M token** (ước tính) | |

> Đây là ước tính của agent, không phải số đo. Số thật xem bằng `/cost` trong Claude Code (hoặc trang usage) rồi cập nhật vào bảng.
