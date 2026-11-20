# Đánh giá từng phase

## Phase 1

**Kết quả:** `npm run proof -- 1` → PASS (9/9 dòng kiểm chứng), `npm test` 35/35. Chi tiết: [docs/proof/phase-1/REPORT.md](../proof/phase-1/REPORT.md).

| Hạng mục | Trạng thái |
|---|---|
| R1–R13, C1–C5 (xem [phase-1.md](phase-1.md)) | Đạt, có test hoặc dòng proof cho từng mục |
| HUD, chơi lại, cảm giác (R11, R12) | Đạt theo ảnh chụp + chơi tay; không tự động hóa được phần "đẹp" |
| Video demo | Chưa làm (để Phase 4) |
| Độ khó | **Chưa tốt**: autopilot thắng 20/20 seed trong 40–70 s / 300 s. Game hơi dễ; có thể chỉnh nhịp sinh Bóng Mực ở phase sau (không phải số trong contract) |
| Hỏng phase trước? | Không áp dụng (phase đầu) |

### AI sai ở đâu và cách phát hiện

| Lỗi | Phát hiện | Sửa / chỉnh harness |
|---|---|---|
| Hai test đọc `snaps.at(-1)` khi `--ticks 5` mà snapshot mặc định mỗi 10 tick → đọc nhầm snapshot tick 0, test đỏ | Test đỏ (game đúng, test sai) | Sửa test dùng `every: 1`. Ghi nhớ: kiểm tra snapshot nào thật sự tồn tại |
| `node --test tests/` lỗi "Cannot find module" trên Node 26 | Chạy thật | Dùng glob `"tests/*.test.js"`, đặt `engines.node >= 22` |
| Ảnh chụp headless Chrome không chạy thời gian (rAF bị bóp) nên không thấy Bóng Mực sinh ra | Xem ảnh, đồng hồ HUD vẫn 4:59 | Thêm preset URL `?shade`, `?lit=N` để dựng cảnh trực tiếp |
| Cây trang trí to che mất nhân vật | Xem ảnh | Giảm số lượng/kích thước cây, tránh khu đèn |
| Hook đọc stdin bằng cách spawn tiến trình con (rối, dễ hỏng) | Tự review | Viết lại bằng `fs.readFileSync(0)`; thử hook với test đỏ cố ý → exit 2 |

### Cần chỉnh cho phase sau
- Khi ticket mới đổi luật: cập nhật `phase-N.md` trước, rồi test, rồi code.
- Chạy agent `contract-reviewer` (không phải agent đã viết code) trước khi gắn tag.
