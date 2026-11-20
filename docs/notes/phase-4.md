# Phase 4: Ticket-04 (tự đặt, khoảng 90 phút)

> Ticket tự đặt (không có giảng viên phát hành, xem [phase-2.md](phase-2.md)). Bám theo README của lab:
> Phase 4 là "hoàn thiện và phát hành", có thể đo hiệu năng (hạng mục E: hiệu năng và ổn định), Release `v1.0.0` và video.

## Ticket-04: Hoàn thiện và phát hành

1. **Hiệu năng (đo được):** `npm run bench` chạy headless trọn một đêm mặc định của mỗi đêm (người chơi đứng yên trong vòng an toàn của một đèn đã sáng để đêm kéo dài tới bình minh) với `--snapshot-every 1`, in JSON gồm số tick, thời gian, tick/giây, thời gian trung bình mỗi bước gameplay.
   - **Ngưỡng:** mỗi đêm đầy đủ qua CLI chạy **dưới 2 s**; mỗi bước gameplay trung bình **dưới 0.5 ms** (tức nhanh hơn thời gian thực ít nhất 33 lần).
2. **Ổn định:** `npm run fuzz` sinh 300 tổ hợp scenario + inputs ngẫu nhiên có seed (cả hai đêm, có pause/dash/pulse). Yêu cầu:
   - Không có lần nào bị crash. File hợp lệ thì mã 0; file bị làm hỏng có chủ đích thì mã 2.
   - Bất biến trên **mọi** snapshot: số liệu hữu hạn; `0 ≤ flames ≤ flames ban đầu`; `carried ≥ 0`; người chơi trong đảo (≤ 40 m); số đèn sáng và điểm không bao giờ giảm; `time_left_s` không tăng; `sim_tick ≤ tick`; không Bóng Mực nào trong `safe_radius` của đèn đã sáng; dòng cuối là `end`.
   - Một mẫu 30 trường hợp chạy hai lần phải giống từng byte.
3. **Chiến dịch trong GUI:** thắng Đêm 1 thì màn kết thúc có nút "Sang Đêm 2". Có **kỷ lục** (điểm cao nhất) theo từng đêm, lưu trong trình duyệt, hiện ở màn bắt đầu và màn kết thúc. Headless không bị ảnh hưởng.
4. **Phát hành v1.0.0:**
   - `npm run build` tạo `dist/web/`: thư mục web tĩnh chạy được với bất kỳ server tĩnh nào. Kèm file zip `dist/dao-den-long-v1.0.0-web.zip`.
   - `package.json` lên bản 1.0.0; ghi chú phát hành trong `docs/RELEASE_NOTES.md`.
   - Lệnh tạo Release trên GitHub (người dùng tự chạy vì cần push).
5. **Video demo** dưới 5 phút và **retro** cuối dự án.

## Tiêu chí nghiệm thu

| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| P4-1 | Bench: cả 2 đêm < 2 s qua CLI; trung bình mỗi bước < 0.5 ms | `npm run bench` → `docs/proof/phase-4/bench.json`; dòng proof |
| P4-2 | Fuzz 300 ca: 0 crash, đúng mã thoát, mọi bất biến đúng, 30 ca tất định | `npm run fuzz` → `docs/proof/phase-4/fuzz.json`; dòng proof |
| P4-3 | Fuzz thật sự bắt được lỗi: cố ý làm hỏng một bất biến thì fuzz báo FAIL | test `fuzz detects a broken invariant` |
| P4-4 | Thắng Đêm 1 thì có nút "Sang Đêm 2" và bấm vào là vào Đêm 2; kỷ lục lưu lại sau khi tải lại trang | playtest |
| P4-5 | `npm run build` tạo thư mục tĩnh chơi được: phục vụ `dist/web` bằng server tĩnh tối giản thì game chạy, không lỗi JS | test build + playtest trên bản build |
| P4-6 | Không hồi quy: đầu ra headless giống tag `phase-3` trên mọi kịch bản | `tools/regress.mjs phase-3` |
| P4-7 | Video, retro, README đầy đủ | xem repo |

## Giả định Phase 4
1. Ngưỡng hiệu năng đặt cho máy chấm cỡ laptop phổ thông. Số đo kèm cấu hình máy.
2. Kỷ lục lưu bằng `localStorage` (mỗi trình duyệt riêng). Nếu không đọc/ghi được thì game vẫn chạy, chỉ không có kỷ lục.
3. Chiến dịch không cộng dồn điểm giữa hai đêm; mỗi đêm có kỷ lục riêng.
4. Bản build dùng đường dẫn tương đối nên chạy được dưới bất kỳ thư mục con nào của server tĩnh. Không chạy được bằng `file://` vì trình duyệt chặn ES module.
