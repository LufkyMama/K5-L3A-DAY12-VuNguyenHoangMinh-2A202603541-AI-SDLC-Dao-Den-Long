# Đảo Đèn Lồng

> 🎬 **Video demo:** sẽ được đính kèm ở Release `v1.0.0` (Phase 4).
> Bài lab Day 12 · AI SDLC · cá nhân · 2A202603541 – Vu Nguyen Hoang Minh. Đề bài gốc: [docs/lab/](docs/lab/README.md).

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng, chạy khắp hòn đảo giữa biển mây gom **đom đóm** để thắp lại **5 Đèn Lồng Lớn** trước bình minh, đồng thời né **Bóng Mực** trong sương đen.

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
| R | Chơi lại sau khi thắng/thua |

Đom đóm được **nhặt tự động** khi chạm (túi chứa tối đa 5). Mỗi đèn cần 5 đom đóm. Bóng Mực không dám vào vòng 4 m quanh đèn (vòng sáng mờ trên mặt đất). Bị Bóng Mực chạm: mất 1 ngọn lửa (có 3), rơi hết đom đóm đang mang, bất tử 1.5 s.

**Thắng:** thắp đủ 5 đèn. **Thua:** hết lửa, hoặc trời sáng (hết 300 s).

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
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
npm test               # 35 test hành vi, chạy qua CLI headless thật
npm run proof -- 1     # tạo lại bằng chứng Phase 1 → docs/proof/phase-1/REPORT.md
```

- `game.contract.json`: `build_cmd` = `npm install`, `headless_cmd` = `node src/headless.js`. Tuning khớp đúng `src/tuning.js` (có test kiểm tra).
- `fall_enabled: false`: mép đảo là tường, không thể rơi khỏi đảo nên không có sự kiện `player_hit` với `by: "fall"`. Không trường tuning nào là `null`.
- File inputs/scenario sai định dạng → mã thoát 2. Lỗi khác (ví dụ `--night 2`) → mã 1.
- Giả định cho các chỗ đề còn mơ hồ: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Chỉ bật trong bản chơi có giao diện (`creative: true`). Headless luôn dùng `creative: false` nên đầu ra theo contract không đổi.

- **Đom Đóm Vàng:** cứ 20 s một con đom đóm vàng to xuất hiện; nhặt được thì Mây chạy nhanh hơn 40% trong 4 s.
- **Cá Voi Mây:** một chú cá voi mây có đốm sáng vàng bơi chậm quanh đảo trong biển mây (chỉ để trang trí).
- **Âm thanh tự sinh** bằng WebAudio (nhặt, nạp, thắp đèn, tỏa sáng, bị chạm), không dùng file âm thanh.
- **Hạt tiến độ** quanh cột đèn (sáng dần theo số đom đóm đã nạp) và **vòng an toàn** mờ quanh mỗi đèn.

Bằng chứng phần cũ vẫn đúng: `tests/creative.test.js` (Đom Đóm Vàng chỉ xuất hiện khi `creative: true`; CLI tạo game với `creative: false`) cùng toàn bộ 35 test và proof vẫn PASS.

## Bằng chứng và ghi chép

| | |
|---|---|
| Bằng chứng Phase 1 | [docs/proof/phase-1/REPORT.md](docs/proof/phase-1/REPORT.md) (test, scenario, autopilot thắng cả đêm, tất định, ảnh GUI) |
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
