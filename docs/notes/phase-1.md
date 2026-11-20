# Phase 1: PRD-0 + Test Contract v1.0

Nguồn: lab board, tab Phase 1 (PRD-0, Test Contract v1.0). Đây là phase duy nhất đã phát hành khi làm phần này.

## 1. Tiêu chí nghiệm thu (yêu cầu → cách kiểm chứng)

| # | Yêu cầu (PRD-0 / Contract) | Tiêu chí kiểm chứng được | Bằng chứng |
|---|---|---|---|
| R1 | Nhân vật đi lại, camera 3D | `move [0,1]` yaw 0 trong 60 tick → z = player_speed; yaw 90 → +X; vector >1 chuẩn hóa | `tests/headless.test.js` (movement, cam_yaw, diagonal) · `gui-play.png` |
| R2 | Nhảy | Nhấn jump → y > 0.5 rồi về 0 | test `jump leaves the ground…` |
| R3 | Đom đóm rải rác, nhặt được | khoảng cách ≤ pickup_radius thì nhặt, > thì không; không vượt carry_capacity | tests pickup/capacity · proof `s01` |
| R4 | Nạp ánh sáng để thắp đèn | interact trong interact_radius → `deposit`; đủ lantern_cost → `lantern_lit` | tests deposit/partial/out-of-range · proof `s02` |
| R5 | Bóng Mực xuất hiện và đuổi | mặc định có `shade_spawned`; Bóng Mực tiến về người chơi đúng shade_speed | tests chase/spawn · proof autopilot |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | pulse: trừ pulse_cost, stun trong pulse_radius, đẩy pulse_push_m, stun pulse_stun_s, cooldown | 4 test pulse · proof `s04` |
| R7 | Bóng Mực sợ đèn | không Bóng Mực nào vào trong safe_radius quanh đèn | test safe zone · proof `s07` · `gui-shades.png` |
| R8 | Chạm Bóng Mực mất máu | `player_hit` −1 flame, rơi đom đóm, bất tử invuln_s | test contact · proof `s05` |
| R9 | Thắng / thua | thắp đủ 5 → won/all_lit; hết flames → lost/no_flames; hết giờ → lost/dawn; headless dừng ngay | tests win/no_flames/dawn · proof `s03 s05 s06` |
| R10 | Điểm số | per_mote, per_lantern, per_stun, thưởng thời gian + flames khi thắng | test win score (=848 ở s03) |
| R11 | HUD + chơi lại | HUD hiện lửa, đom đóm, đèn, điểm, giờ, pulse; màn kết thúc có nút/phím R chơi lại | `gui-play.png` · [playtest/PLAYTEST.md](../proof/phase-1/playtest/PLAYTEST.md) (thắng → R → thua → nút "Chơi lại") |
| R14 | Bản GUI đúng như headless khi chơi bằng phím thật | W/D/Space/E/F/R và nút bấm tạo đúng hành vi; điểm thắng đúng công thức README; không lỗi JS | `npm run playtest -- 1` (15/15) |
| R12 | Không khí: đảo sáng dần khi thắp đèn; vàng cam = tốt; tím đen = nguy hiểm; Mây đội nón lá có đèn nhỏ | ảnh so sánh 0/5 với 3/5 đèn | `gui-play.png` vs `gui-lit3.png` |
| R13 | Chơi được Đêm 1 từ đầu tới thắng/thua | inputs ghi lại từ autopilot, chạy lại qua CLI → won | proof `autopilot-seed1`, autopilot thắng 20/20 seed |
| C1 | game.contract.json đủ trường, tuning đúng số game dùng | tuning trong file == `src/tuning.js` | `tests/contract.test.js` |
| C2 | Mô hình tick, snapshot, end, làm tròn | snapshot 0 trước input; snapshot mỗi N; dòng end cuối; `--ticks N` chạy đúng N bước | test output format |
| C3 | Tất định | cùng seed+inputs → giống từng byte; seed khác → khác | test + proof determinism (sha256) |
| C4 | File sai định dạng → mã 2 | 7 ca sai (JSON hỏng, tick không tăng, move ngoài [-1,1], kiểu sai, id đèn lạ…) | test malformed |
| C5 | Chạy trên macOS/Linux | Node ≥ 22, không phụ thuộc native; CI chạy ubuntu + macos | `.github/workflows/ci.yml` |

## 2. Giả định (chỗ PRD-0 / contract chưa nói rõ)

1. **Nhặt đom đóm tự động** khi chạm (≤ pickup_radius), không cần nhấn nút. Nhiều con trong cùng tick thì nhặt theo thứ tự id cho tới khi đầy túi.
2. **Nạp đèn cần nhấn interact (E)** trong interact_radius; chọn đèn chưa sáng gần nhất; nạp `min(carried, lantern_cost − deposited)`. Không có đom đóm thì không có sự kiện.
3. **Tỏa sáng tốn 1 đom đóm đang mang** (pulse_cost). Không đủ thì không có pulse, không tốn cooldown. Pulse vẫn ghi sự kiện dù `stunned_ids` rỗng (đã tốn ánh sáng). Bóng Mực đang choáng vẫn bị tính lại (choáng lại, cộng per_stun).
4. **Đẩy lùi** là dịch tức thời pulse_push_m theo hướng từ người chơi ra Bóng Mực (mặt phẳng XZ), sau đó áp ràng buộc safe_radius và biên đảo.
5. **Choáng**: Bóng Mực đứng yên đúng `pulse_stun_s × 60` tick, sau đó trở lại `chase`. Trạng thái Bóng Mực: `chase`, `stunned`.
6. **Bị chạm**: −1 flame, rơi `floor(carried × hit_drop_ratio)` đom đóm (ratio = 1, tức rơi hết), bất tử `invuln_s`. Đom đóm rơi **bay mất** (không tạo lại trên mặt đất) để thế giới `random_motes:false` đúng là chỉ có những con được liệt kê. Một tick chỉ bị chạm tối đa một lần.
7. **safe_radius áp dụng cho mọi đèn**, sáng hay chưa sáng ("Bóng Mực sợ những chiếc đèn"; định nghĩa trong contract không nhắc điều kiện sáng). Bóng Mực bị đẩy ra cách đèn `safe_radius + 0.01` m.
8. **Không có rơi khỏi đảo**: đảo bán kính 40 m, mép đảo là tường mềm → `fall_enabled: false`, không có sự kiện `player_hit by fall`.
9. **Điểm**: per_mote khi nhặt, per_lantern khi thắp, per_stun mỗi Bóng Mực bị choáng. **Chỉ khi thắng** cộng `per_second_left × floor(time_left_s)` và `per_flame_left × flames`. Thua không có thưởng.
10. **Sinh thực thể** (khi `random_*` true): 30 đom đóm ban đầu, thêm 1 con mỗi 2 s khi còn < 20. Bóng Mực đầu tiên ở giây 8, sau đó mỗi 15 s, tối đa 5, sinh trên vòng bán kính 37 m, phía xa người chơi. Id: `M1…`, `S1…` theo thứ tự sinh; id tự sinh bỏ qua id đã có trong scenario.
11. **Vị trí đèn mặc định**: vòng bán kính 25 m, L1 tại (0,0,25), các đèn sau cách nhau 72° (`x = 25·sin a, z = 25·cos a`).
12. Scenario `lit:true` mà không có `deposited` → `deposited = lantern_cost`; `deposited ≥ lantern_cost` mà không có `lit` → đèn sáng. Đèn đặt sẵn sáng không cộng điểm. Nếu cả 5 đèn sáng ngay từ đầu thì thắng (`all_lit`) ở tick 1, chỉ có điểm thưởng thắng.
13. **Nhảy** 7 m/s, trọng lực 20 m/s² (cao ~1.2 m). Nhảy không giúp né Bóng Mực vì khoảng cách tính theo XZ.
14. `dash` chưa có (bỏ qua). Cờ CLI lạ: cảnh báo ra stderr rồi bỏ qua. `--night` khác 1 → mã 1. File thiếu / JSON hỏng / trường sai → mã 2.
15. Snapshot chỉ ở các tick chia hết cho `--snapshot-every` (không thêm snapshot cuối); dòng `end` luôn có. Mảng `motes` (id, pos) có trong snapshot.
16. "Trong bán kính r" được so với `r + 1e-6` để bù sai số số thực (ví dụ lệch (0.72, 0.96) cho hypot 1.2000000000000002).
17. Bóng Mực trong scenario nằm trong `safe_radius` của một đèn bị đẩy ra ngay khi dựng (snapshot 0 đã ở ngoài). Scenario `flames: 0` → thua `no_flames` ở tick 1. `carried` lớn hơn sức chứa được giữ nguyên (chỉ không nhặt thêm). Bóng Mực đang choáng không gây sát thương.
18. CLI nhận cả `--key value` và `--key=value`; cờ lạ (có hoặc không có giá trị) chỉ cảnh báo.

## 3. Quyết định kỹ thuật

- **JavaScript thuần + Three.js**: một file luật chơi `src/sim.js` dùng chung cho headless (Node) và bản chơi (trình duyệt) nên hai chế độ không thể lệch nhau. Không cần build, không phụ thuộc native, chạy được trên macOS/Linux/Windows.
- **Tick nguyên**: mọi bộ đếm thời gian là số tick nguyên; RNG mulberry32 theo seed → tất định.
- **Một nguồn số liệu**: `src/tuning.js`; test buộc `game.contract.json` phải khớp.
