# Changelog

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
