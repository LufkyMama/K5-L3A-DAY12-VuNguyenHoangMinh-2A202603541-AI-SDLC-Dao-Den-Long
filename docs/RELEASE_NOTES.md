# Đảo Đèn Lồng v1.0.0

Bản phát hành cuối của bài lab Day 12 (AI SDLC).

## Có gì trong bản này
- **Hai đêm chơi:** Đêm 1 – Đảo Bến (5 đèn, 300 s) và Đêm 2 – Rừng Sương (6 đèn, 360 s, có Bóng Mực Lớn). Thắng Đêm 1 thì đi tiếp sang Đêm 2.
- **Điều khiển:** WASD di chuyển, chuột hoặc ←/→ xoay camera, Space nhảy, E nạp đèn, F tỏa sáng, Shift lướt, P/Esc tạm dừng, R chơi lại, N sang đêm sau.
- **Kỷ lục** điểm theo từng đêm, lưu trong trình duyệt.
- **Headless** theo Test Contract (v1.0, mở rộng tới v1.2): `node src/headless.js --seed <n> --night 1|2 --ticks <n> --out f.jsonl [...]`.

## Cách chạy
**Từ mã nguồn** (macOS/Linux/Windows, Node ≥ 22):
```bash
npm install
npm start            # http://localhost:8080
```
**Từ file đính kèm** `dao-den-long-v1.0.0-web.zip` (thư mục web tĩnh, không cần Node):
```bash
unzip dao-den-long-v1.0.0-web.zip && cd dao-den-long-v1.0.0
python3 -m http.server 8080      # hoặc bất kỳ server tĩnh nào, rồi mở http://localhost:8080
```
Không mở trực tiếp `index.html` bằng `file://`, vì trình duyệt chặn ES module.

## Chất lượng (đo ở phase-4, xem `docs/proof/phase-4/`)
- 69 test tự động; proof cộng dồn cả 4 phase đều PASS. Chơi thử GUI bằng phím/chuột thật qua Chrome PASS, trên cả bản dev lẫn bản build.
- Hiệu năng: một đêm headless đầy đủ (`--snapshot-every 1`) chạy dưới 0.5 s; mỗi bước gameplay khoảng 0.003 ms.
- Ổn định: fuzz 300 ca có seed: 0 crash, 0 vi phạm bất biến, file hỏng đều trả mã 2, 30 ca chạy lại giống từng byte.

## Ghi chú trung thực
Ticket-02/03/04 do agent tự đặt vì buổi lab không có giảng viên phát hành (ghi trong `docs/notes/phase-2.md` … `phase-4.md`).
