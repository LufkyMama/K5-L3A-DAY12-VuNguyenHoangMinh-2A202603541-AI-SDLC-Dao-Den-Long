# Phase 2: Ticket-02 (tự đặt)

> **Lưu ý trung thực:** buổi lab này không có giảng viên phát hành Ticket-02/03/04. Theo yêu cầu của chủ repo
> ("không có lab coach, làm theo từng quy trình"), agent tự viết ticket theo mạch của PRD-0 rồi làm đủ vòng SDLC.
> Ticket dưới đây **không phải đề của giảng viên**.

## Ticket-02: Đêm 2 – Rừng Sương

1. **Màn mới:** `--night 2`, "Đêm 2 – Rừng Sương": 6 Đèn Lồng Lớn `L1…L6` trên vòng bán kính 28 m, đêm dài 360 s. Thắp đủ 6 đèn thì thắng.
2. **Kẻ địch mới: Bóng Mực Lớn** (`kind: "big"`): chậm hơn (`big_shade_speed`), nhưng bán kính chạm lớn hơn (`big_shade_hit_radius`). Tỏa sáng có tác dụng như với Bóng Mực thường. Ở Đêm 2, cứ con thứ 3 được sinh ra là Bóng Mực Lớn.
3. **CR-1, thay đổi yêu cầu từ khách hàng:** "Bóng Mực chỉ sợ những chiếc đèn **đã được thắp**." Từ nay `safe_radius` chỉ áp dụng quanh đèn đã sáng, ở **cả hai đêm**. Bóng Mực đang ở trong vòng của một đèn vừa sáng sẽ bị đẩy ra ngay.
4. **Test Contract v1.1** (tương thích ngược với v1.0):
   - `contract_version: "1.1"`. `tuning` thêm `lantern_count_night2`, `night2_duration_s`, `big_shade_speed`, `big_shade_hit_radius`.
   - Snapshot thêm `night`. Mỗi phần tử `shades[]` thêm `kind` (`"ink"` | `"big"`).
   - Scenario: `shades[]` nhận thêm `kind`; id đèn hợp lệ phụ thuộc đêm (`L1…L5` ở đêm 1, `L1…L6` ở đêm 2). Id sai thì thoát mã 2.
   - `--night` khác 1 và 2 thì thoát mã 1.
5. **GUI:** màn bắt đầu cho chọn Đêm 1 hoặc Đêm 2. Đêm 2 có sương xanh rừng dày hơn. HUD hiện số đêm. Bóng Mực Lớn to hơn rõ rệt.

## Tiêu chí nghiệm thu

| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| P2-1 | `--night 2`: snapshot 0 có `night: 2`, 6 đèn `L1…L6` cách tâm 28 m, `time_left_s = 360` | test `night 2 layout` |
| P2-2 | Đêm 2 chỉ thắng khi đủ 6 đèn (5 đèn chưa đủ) | test + proof `p2-night2-win` |
| P2-3 | Bóng Mực Lớn đi đúng `big_shade_speed`, chạm ở đúng `big_shade_hit_radius` (vượt quá thì không chạm) | test |
| P2-4 | Đêm 2 mặc định: con thứ 3 được sinh ra có `kind: "big"`; Đêm 1 không bao giờ có `big` | test |
| P2-5 | CR-1: đèn chưa sáng không đẩy Bóng Mực; đèn sáng thì đẩy; đèn vừa sáng đẩy ngay ở bước đó | 3 test + proof `s07` (đã sửa) |
| P2-6 | Scenario id `L6` hợp lệ ở đêm 2, sai ở đêm 1 (mã 2); `kind` sai thì mã 2; `--night 3` thì mã ≠ 0 | test |
| P2-7 | Đêm 2 chơi được từ đầu tới thắng (autopilot, phát lại qua CLI) | proof `autopilot-night2` |
| P2-8 | Mọi test Phase 1 không bị CR-1 thay thế vẫn đạt (hồi quy) | `npm test` |
| P2-9 | GUI chọn được Đêm 2 và chơi được | `npm run playtest` (thêm kiểm tra chọn đêm) |

## Thay đổi test cũ do CR-1 (ghi lý do, không tắt âm thầm)

| Test / kịch bản cũ | Trước | Sau | Lý do |
|---|---|---|---|
| `shades never enter safe_radius…` | đèn L1 chưa sáng vẫn đẩy | dựng L1 **sáng** | CR-1: chỉ đèn sáng mới đẩy |
| `R-c: scenario shade inside safe_radius…` | đèn chưa sáng | đèn **sáng** | CR-1 |
| proof `s07-safe-zone` | L1 chưa sáng | L1 `lit: true` | CR-1 |
| Giả định 7 (Phase 1) | mọi đèn | chỉ đèn đã sáng | bị CR-1 thay thế |

## Giả định Phase 2

1. Thông số Đêm 2 (không có trong contract): Bóng Mực đầu tiên ở giây 5, sau đó mỗi 12 s, tối đa 6 con; đom đóm giống Đêm 1 (30 con ban đầu, giữ tối thiểu 20).
2. Bóng Mực Lớn chịu tỏa sáng giống hệt Bóng Mực thường (choáng `pulse_stun_s`, bị đẩy `pulse_push_m`), không có máu riêng.
3. Bóng Mực trong scenario không có `kind` thì là `"ink"`.
4. `lantern_count_night1` vẫn là 5; điểm và cách tính thưởng giống Đêm 1.
5. Id đèn sinh theo góc: L1 tại (0,0,28), các đèn sau cách nhau 60°.
