# Đảo Đèn Lồng

> 🎬 **Video demo:** sẽ được đính kèm ở Release `v1.0.0` (Phase 4).
> Bài lab Day 12 · AI SDLC · cá nhân · 2A202603541 – Vu Nguyen Hoang Minh. Đề bài gốc: [docs/lab/](docs/lab/README.md).

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng, chạy khắp hòn đảo giữa biển mây gom **đom đóm** để thắp lại các **Đèn Lồng Lớn** trước bình minh, đồng thời né **Bóng Mực** trong sương đen.

| Đêm | Đèn | Thời gian | Kẻ địch |
|---|---|---|---|
| 1 – Đảo Bến | 5 | 300 s | Bóng Mực |
| 2 – Rừng Sương | 6 | 360 s | Bóng Mực + **Bóng Mực Lớn** (chậm hơn, chạm xa hơn) |

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 22)

```bash
npm install      # cài three.js (thư viện duy nhất)
npm start        # rồi mở http://localhost:8080
```

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D (hoặc ↑ ↓) | Di chuyển, theo hướng camera |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào Đèn Lồng Lớn ở gần (≤ 2.5 m) |
| F | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| Shift | Lướt: lao 3.6 m trong 0.2 s theo hướng đang đi, hồi chiêu 2 s |
| P / Esc | Tạm dừng / chơi tiếp |
| 1 / 2 | Chọn đêm ở màn bắt đầu |
| R | Chơi lại sau khi thắng/thua |

Chọn đêm ở màn bắt đầu (nút hoặc phím 1/2). Đom đóm được **nhặt tự động** khi chạm (túi chứa tối đa 5). Mỗi đèn cần 5 đom đóm. Bóng Mực không dám vào vòng 4 m quanh đèn **đã thắp** (vòng sáng mờ trên mặt đất); đèn chưa thắp không che chở được. Bị Bóng Mực chạm: mất 1 ngọn lửa (có 3), rơi hết đom đóm đang mang, bất tử 1.5 s.

**Thắng:** thắp đủ mọi đèn của đêm. **Thua:** hết lửa, hoặc trời sáng.

## Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp sáng 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi một lần tỏa sáng | +20 |
| Khi **thắng**: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi **thắng**: mỗi ngọn lửa còn lại | +50 |

## Headless (Test Contract v1.0) và kiểm chứng

```bash
node src/headless.js --seed 1 --night 1|2 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
npm test               # 42 test hành vi, chạy qua CLI headless thật
npm run proof -- 1     # tạo lại bằng chứng Phase 1 → docs/proof/phase-1/REPORT.md
npm run playtest -- 1  # chơi thử bản GUI bằng phím/chuột thật qua Chrome → docs/proof/phase-1/playtest/PLAYTEST.md
```

- `game.contract.json`: `build_cmd` = `npm install`, `headless_cmd` = `node src/headless.js`. Tuning khớp đúng `src/tuning.js` (có test kiểm tra).
- `fall_enabled: false`: mép đảo là tường, không thể rơi khỏi đảo nên không có sự kiện `player_hit` với `by: "fall"`. Không trường tuning nào là `null`.
- File inputs/scenario sai định dạng → mã thoát 2. Lỗi khác (ví dụ `--night 2`) → mã 1.
- Contract **v1.1** (Phase 2, tương thích ngược): thêm `--night 2`, `night` trong snapshot, `kind` (`ink`/`big`) cho Bóng Mực, tuning `lantern_count_night2`, `night2_duration_s`, `big_shade_speed`, `big_shade_hit_radius`.
- Contract **v1.2** (Phase 3): input `pause` và `dash`; snapshot thêm `paused`; khi tạm dừng `tick` vẫn tăng nhưng `sim_tick` và `time_left_s` đứng yên; sự kiện mới `pause`, `dash`; tuning `dash_speed_mult`, `dash_duration_s`, `dash_cooldown_s`.
- `node tools/regress.mjs <tag-cũ> --drop=<trường mới>`: so đầu ra headless với một tag cũ để chứng minh không hồi quy.
- Giả định cho các chỗ đề còn mơ hồ: [phase-1.md](docs/notes/phase-1.md), [phase-2.md](docs/notes/phase-2.md), [phase-3.md](docs/notes/phase-3.md).

## Sáng tạo của tôi

Chỉ bật trong bản chơi có giao diện (`creative: true`). Headless luôn dùng `creative: false` nên đầu ra theo contract không đổi.

- **Đom Đóm Vàng:** cứ 20 s một con đom đóm vàng to xuất hiện; nhặt được thì Mây chạy nhanh hơn 40% trong 4 s.
- **Cá Voi Mây:** một chú cá voi mây có đốm sáng vàng bơi chậm quanh đảo trong biển mây (chỉ để trang trí).
- **Âm thanh tự sinh** bằng WebAudio (nhặt, nạp, thắp đèn, tỏa sáng, bị chạm), không dùng file âm thanh.
- **Hạt tiến độ** quanh cột đèn (sáng dần theo số đom đóm đã nạp) và **vòng an toàn** mờ quanh mỗi đèn.

Bằng chứng phần cũ vẫn đúng: `tests/creative.test.js` (Đom Đóm Vàng chỉ xuất hiện khi `creative: true`; đầu ra CLI giống hệt game `creative: false` và khác game `creative: true`) cùng toàn bộ 42 test, proof và chơi thử GUI vẫn PASS.

## Bằng chứng và ghi chép

| | |
|---|---|
| Bằng chứng Phase 1 | [docs/proof/phase-1/REPORT.md](docs/proof/phase-1/REPORT.md) (test, scenario, autopilot thắng cả đêm, tất định, ảnh GUI) · [chơi thử GUI](docs/proof/phase-1/playtest/PLAYTEST.md) (15 kiểm tra bằng phím/chuột thật) |
| Yêu cầu, tiêu chí, giả định | [docs/notes/phase-1.md](docs/notes/phase-1.md) |
| Đánh giá từng phase | [docs/notes/evaluation.md](docs/notes/evaluation.md) |
| Nhật ký dùng AI và token | [docs/notes/ai-log.md](docs/notes/ai-log.md) |
| Retro | [docs/notes/retro.md](docs/notes/retro.md) |
| Harness AI | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), `.claude/` (hook test-gate, skill `verify`, agent `contract-reviewer`), CI `.github/workflows/ci.yml` |

## Cấu trúc

```text
src/sim.js        luật chơi tất định (dùng chung headless + GUI)
src/tuning.js     mọi con số gameplay
src/headless.js   CLI headless · src/validate.js kiểm tra file inputs/scenario
web/              bản chơi Three.js (render, input, HUD, âm thanh)
server.js         server tĩnh cho npm start
tests/            test + tests/scenarios/ (scenario headless có tên)
tools/            autopilot.js, proof.js
docs/             lab/ (đề), notes/, proof/
```

Giấy phép MIT ([LICENSE](LICENSE)). Nguồn: [CREDITS.md](CREDITS.md).
