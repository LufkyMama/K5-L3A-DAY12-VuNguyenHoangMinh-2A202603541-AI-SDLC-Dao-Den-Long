# Phase 3: Ticket-03 (tự đặt, khoảng 30 phút)

> Ticket tự đặt vì buổi lab không có giảng viên phát hành (xem [phase-2.md](phase-2.md)). Ý tưởng lấy từ chính contract v1.0:
> nút `dash` đã được nhắc ("và dash nếu có"), và câu "sim_tick là số bước gameplay đã chạy (ở Phase 1 bằng tick)"
> cho thấy sẽ có lúc `sim_tick` khác `tick`, tức là có tạm dừng.

## Ticket-03: Tạm dừng và Lướt

1. **Tạm dừng:** input `pause` (bật khi chuyển false → true, nhấn lần nữa thì tiếp tục). Khi đang dừng:
   - `tick` vẫn tăng (snapshot vẫn ra mỗi `--snapshot-every` tick, `--ticks N` vẫn là N tick); **`sim_tick` và `time_left_s` đứng yên**.
   - Không có gì di chuyển, không có sự kiện, không cộng điểm. Nút bấm trong lúc dừng không kích hoạt hành động khi tiếp tục.
   - Snapshot thêm trường `paused` (boolean). Sự kiện mới `pause` `{paused: true|false}` khi đổi trạng thái.
2. **Lướt (dash):** input `dash` (bật khi false → true). Nếu đã hồi chiêu: Mây lao theo hướng đang di chuyển (sau khi xoay theo camera) với tốc độ `player_speed × dash_speed_mult` trong `dash_duration_s`; đứng yên thì lao theo hướng di chuyển gần nhất (mặc định +Z). Hồi chiêu `dash_cooldown_s`. Sự kiện mới `dash` `{dir: [x, z]}`.
3. **Test Contract v1.2** (tương thích ngược): tuning thêm `dash_speed_mult`, `dash_duration_s`, `dash_cooldown_s`; input thêm `pause`; snapshot thêm `paused`; sự kiện thêm `pause`, `dash`.
4. **GUI:** phím P (hoặc Esc) tạm dừng và hiện bảng "Tạm dừng"; Shift để lướt; HUD hiện trạng thái lướt.

## Tiêu chí nghiệm thu

| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| P3-1 | Dừng 60 tick: `tick` tăng 60, `sim_tick` không đổi, vị trí người chơi/Bóng Mực và `time_left_s` không đổi, `paused: true` | test |
| P3-2 | Tiếp tục thì chạy lại bình thường; đêm kết thúc trễ đúng bằng số tick đã dừng (dawn ở `tick` = thời lượng + số tick dừng) | test + proof `p3-pause-dawn` |
| P3-3 | Không có sự kiện hay điểm khi đang dừng; nút interact giữ trong lúc dừng không nạp đèn khi tiếp tục | test |
| P3-4 | Lướt: trong `dash_duration_s` đi được `player_speed × dash_speed_mult × dash_duration_s` m theo hướng move (đã xoay yaw) | test + proof `p3-dash` |
| P3-5 | Hồi chiêu: lướt lần 2 trước `dash_cooldown_s` không có tác dụng; đúng lúc hết hồi chiêu thì được | test |
| P3-6 | Đứng yên mà lướt thì lao theo hướng di chuyển gần nhất (mặc định +Z) | test |
| P3-7 | Không dùng pause/dash thì đầu ra giống hệt Phase 2 (trừ trường `paused` mới) | test so với snapshot không pause |
| P3-8 | `pause`/`dash` không phải boolean thì mã 2 | test |
| P3-9 | GUI: P tạm dừng (bảng hiện, đồng hồ đứng), P tiếp tục; Shift lướt | playtest |

## Giả định Phase 3
1. Snapshot vẫn theo `tick` (gồm cả tick dừng) để mô hình tick của contract không đổi; `time_left_s` theo `sim_tick`.
2. Đang lướt vẫn có thể bị Bóng Mực chạm (không bất tử). Lướt không xuyên qua mép đảo.
3. Lướt không tốn đom đóm. Đang lướt thì bỏ qua input move (hướng khóa từ lúc bắt đầu).
4. Tạm dừng không có tác dụng sau khi đêm đã kết thúc.
5. Tick bỏ tạm dừng là một bước gameplay bình thường: nút **mới nhấn đúng tick đó** vẫn có tác dụng; nút đã nhấn từ lúc đang dừng thì không. (Làm rõ sau review Phase 3.)
6. Lướt luôn đi đủ quãng đường, không phụ thuộc độ lớn của cần điều khiển, chỉ lấy hướng.
