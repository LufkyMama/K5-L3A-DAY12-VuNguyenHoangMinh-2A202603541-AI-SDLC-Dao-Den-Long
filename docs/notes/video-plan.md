# Kịch bản video demo (quay ở Phase 4, dưới 5 phút)

Video phải phản ánh bản cuối (sau Ticket-04), nên chỉ quay khi Phase 4 xong. Người quay: tác giả, chơi tay.

| Thời lượng | Nội dung | Lệnh / thao tác |
|---|---|---|
| 0:00–0:20 | Giới thiệu: tên game, mục tiêu, repo | Mở README |
| 0:20–2:00 | **Chơi tay** một đêm: nhặt đom đóm, nạp E, tỏa sáng F, Bóng Mực không vào vòng đèn, đảo sáng dần, màn thắng hoặc thua, nhấn R | `npm start` → http://localhost:8080 |
| 2:00–3:00 | Bằng chứng tự động đạt | `npm test` · `npm run proof -- 4` (đọc dòng Overall: PASS) · `npm run playtest -- 4` |
| 3:00–3:30 | Headless theo contract + tất định | `node src/headless.js --seed 1 --night 1 --ticks 600 --out a.jsonl` hai lần, so `sha256sum` |
| 3:30–4:00 | Đo hiệu năng nếu Ticket-04 yêu cầu | lệnh đo theo ticket |
| 4:00–4:40 | Harness AI + lịch sử git | `CLAUDE.md`, `.claude/` (hook test-gate, skill verify, agent contract-reviewer), `git log --oneline`, `git tag` |

Quay: Windows `Win + Alt + R` (Xbox Game Bar) hoặc OBS, xuất `.mp4`. Đính kèm Release:
`gh release create v1.0.0 demo.mp4 --title "v1.0.0" --notes "Ban phat hanh cuoi"`, rồi đặt link ở đầu README.
