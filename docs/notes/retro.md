# Retro: toàn bộ dự án Đảo Đèn Lồng

## Số liệu

| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Commit (cộng dồn từ đầu) | 10 | 17 | 23 | ~32 |
| Test tự động (cộng dồn) | 42 | 54 | 65 | 69 |
| Dòng proof (cộng dồn) | 9 | 13 | 16 | 19 |
| Kiểm tra chơi thử GUI bằng phím thật | 15 | 19 | 22 | 25 (trên cả bản dev lẫn bản build) |
| Lỗi review độc lập tìm ra / đã sửa | 7 / 7 | 0 lỗi code (6 test yếu) | 0 lỗi code (4 góp ý) | xem evaluation.md |

- Khoảng 2.75k dòng code + test + công cụ (`src/`, `web/`, `tests/`, `tools/`).
- Hiệu năng: một đêm headless đầy đủ khoảng 0.33 s (Đêm 1) và 0.43 s (Đêm 2); mỗi bước gameplay khoảng 0.003 ms.
- Ổn định: fuzz 300 ca, 0 crash, 0 vi phạm bất biến.
- Hồi quy: mỗi phase so đầu ra với tag trước bằng `tools/regress.mjs`: 21/21 kịch bản giống từng byte (phase-2→3), và tất cả giống (phase-3→4).
- Token: xem [ai-log.md](ai-log.md). Phần tốn nhất là review độc lập (khoảng 90–170k token mỗi vòng).

## Điều làm tốt
1. **Một module luật chơi tất định** (`src/sim.js`) dùng chung cho headless và GUI: không lần nào hai chế độ lệch nhau.
2. **Viết test trước từ chữ của ticket/contract.** Ở mỗi phase, test mới đỏ đúng chỗ còn thiếu (Phase 2: 8 đỏ; Phase 3: 9 đỏ); chạy test mới trên code cũ thì fail (Phase 2: 10/12).
3. **Hook test-gate** chặn kết thúc khi test đỏ, và báo ngay sau mỗi lần sửa file.
4. **Review bởi agent khác** bắt được lỗi mà chính agent viết code bỏ qua: so khoảng cách bị sai số số thực ở đúng bán kính, cờ CLI lạ, các ca biên của scenario, test luôn-đạt, file kết quả cũ bị dùng lại.
5. **Bằng chứng tự sinh, không sửa tay.** Reviewer tạo lại `REPORT.md` và `runs/*.jsonl` thì giống hệt, chỉ khác dòng thời gian.

## Điều chưa tốt
1. **Chính agent đã viết ra một kiểm tra luôn-đạt** (`score === score` trong bản đầu của playtest) và một test so HEAD với HEAD. Tự review bắt được cái đầu, reviewer bắt được cái sau. Bài học: không có reviewer độc lập thì loại lỗi này dễ lọt.
2. **Sửa file bằng script nhúng trong shell** (heredoc, `node -e`, `sed`) gây lỗi thoát ký tự vài lần (regex bị xuống dòng, chuỗi không khớp). Lẽ ra nên dùng Edit hoặc viết patch ra file ngay từ đầu.
3. **Ticket 02–04 do agent tự đặt.** Quy trình làm đúng, nhưng không kiểm được với test ẩn thật của giảng viên. CR-1 đổi hành vi Đêm 1, rủi ro này đã ghi trong evaluation.
4. **Độ khó**: autopilot thắng 20/20 ở cả hai đêm. Người chơi thật chậm hơn bot nhiều, nhưng chưa có số đo với người chơi.
5. **Chưa có ai chơi tay.** Mọi lần chơi GUI đều do bot bấm phím thật; video cũng do bot chơi (có ghi rõ trong video).

## Nếu làm lại
- Viết sẵn `tools/regress.mjs` và bộ bất biến (`invariants.mjs`) ngay từ Phase 1, để mọi phase đều có kiểm hồi quy tự động.
- Gom code điều khiển bot dùng chung cho playtest và video (hiện đang lặp lại khoảng 30 dòng).
- Mỗi phase, sau khi xong, nhờ một người thật chơi 5 phút và ghi cảm nhận về độ khó.
- Giới hạn phạm vi reviewer vào phần thay đổi ngay từ vòng đầu để tiết kiệm token.
