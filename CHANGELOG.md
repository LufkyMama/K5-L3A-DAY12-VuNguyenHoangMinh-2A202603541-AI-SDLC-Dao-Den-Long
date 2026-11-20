# Changelog

## phase-4 / v1.0.0 (Ticket-04 tự đặt)
- Hiệu năng: `npm run bench` (một đêm đầy đủ ~0.3–0.4 s qua CLI; ngưỡng 2 s).
- Ổn định: `npm run fuzz` (300 ca, bộ kiểm bất biến độc lập với sim, có test chứng minh nó bắt được lỗi).
- GUI: kỷ lục theo đêm, nút "Sang Đêm 2".
- Phát hành: `npm run build` (web tĩnh + zip), bản 1.0.0, ghi chú phát hành; chơi thử chạy được trên cả bản build.
- Video demo `docs/demo/demo.mp4` quay tự động bằng `tools/demo-video.mjs`.

## phase-3 (Ticket-03 tự đặt)
- Tạm dừng (`pause`, P/Esc): `tick` tăng, `sim_tick`/thời gian/thực thể đứng yên; snapshot có `paused`.
- Lướt (`dash`, Shift): 3.6 m trong 0.2 s, hồi chiêu 2 s.
- Contract v1.2. Công cụ `tools/regress.mjs` so đầu ra với tag cũ (21/21 giống `phase-2`).

## phase-2 (Ticket-02 tự đặt)
- Đêm 2 – Rừng Sương (`--night 2`): 6 đèn, 360 s, sương xanh rừng.
- Kẻ địch mới Bóng Mực Lớn (`kind: "big"`).
- CR-1: Bóng Mực chỉ sợ đèn đã thắp (cả hai đêm); 3 test/kịch bản Phase 1 sửa kèm lý do.
- Contract v1.1; GUI chọn đêm; proof, autopilot, playtest phủ Đêm 2.

## phase-1
- Đêm 1 – Đảo Bến chơi được: di chuyển, nhảy, camera 3D, đom đóm, nạp và thắp 5 Đèn Lồng Lớn, Bóng Mực đuổi, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Headless mode theo Test Contract v1.0 (`node src/headless.js`), `game.contract.json`.
- Test (42), scenario headless, autopilot, báo cáo bằng chứng `npm run proof`, CI ubuntu + macOS.
- Chơi thử GUI tự động bằng phím/chuột thật qua Chrome: `npm run playtest` (15 kiểm tra).
- Harness: CLAUDE.md/AGENTS.md, hook test-gate (PostToolUse + Stop), skill `verify`, agent `contract-reviewer`.
- Sáng tạo: Đom Đóm Vàng, Cá Voi Mây, âm thanh WebAudio (chỉ trong bản GUI).
