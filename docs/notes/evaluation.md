# Đánh giá từng phase

## Phase 1

**Kết quả:** `npm run proof -- 1` → PASS (9/9 dòng kiểm chứng), `npm test` 42/42, chơi thử GUI 15/15. Chi tiết: [docs/proof/phase-1/REPORT.md](../proof/phase-1/REPORT.md).

| Hạng mục | Trạng thái |
|---|---|
| R1–R13, C1–C5 (xem [phase-1.md](phase-1.md)) | Đạt, có test hoặc dòng proof cho từng mục |
| HUD, chơi lại, cảm giác (R11, R12, R14) | Đạt: chơi thử GUI tự động bằng phím/chuột thật 15/15 + ảnh chụp. Phần "đẹp" chỉ đánh giá bằng mắt |
| Chơi tay bởi người | **Chưa có bằng chứng**: tác giả cần tự chơi một ván trước khi nộp |
| Video demo | Chưa làm (để Phase 4) |
| Độ khó | **Chưa tốt**: autopilot thắng 20/20 seed trong 40–70 s / 300 s. Game hơi dễ; có thể chỉnh nhịp sinh Bóng Mực ở phase sau (không phải số trong contract) |
| Hỏng phase trước? | Không áp dụng (phase đầu) |

### AI sai ở đâu và cách phát hiện

| Lỗi | Phát hiện | Sửa / chỉnh harness |
|---|---|---|
| Hai test đọc `snaps.at(-1)` khi `--ticks 5` mà snapshot mặc định mỗi 10 tick → đọc nhầm snapshot tick 0, test đỏ | Test đỏ (game đúng, test sai) | Sửa test dùng `every: 1`. Ghi nhớ: kiểm tra snapshot nào thật sự tồn tại |
| `node --test tests/` lỗi "Cannot find module" trên Node 26 | Chạy thật | Dùng glob `"tests/*.test.js"`, đặt `engines.node >= 22` |
| Ảnh chụp headless Chrome không chạy thời gian (rAF bị bóp) nên không thấy Bóng Mực sinh ra | Xem ảnh, đồng hồ HUD vẫn 4:59 | Thêm preset URL `?shade`, `?lit=N` để dựng cảnh trực tiếp |
| Cây trang trí to che mất nhân vật | Xem ảnh | Giảm số lượng/kích thước cây, tránh khu đèn |
| Hook đọc stdin bằng cách spawn tiến trình con (rối, dễ hỏng) | Tự review | Viết lại bằng `fs.readFileSync(0)`; thử hook với test đỏ cố ý → exit 2 |
| Bản đầu của `tools/playtest.mjs` có kiểm tra điểm thắng dạng `score === score` (**luôn đạt**, đúng loại "test giả" mà RULES cấm) | Tự review trước khi chạy | Sửa thành điểm kỳ vọng = điểm trước lần nạp cuối + 100 + 2×floor(giây còn) + 50×lửa. Thêm vào skill `verify`: "không bao giờ so `x === x`" |
| Extension Claude in Chrome không kết nối nên không chơi thử trên Chrome thật được | Lỗi công cụ | Viết driver CDP (`tools/playtest.mjs`) gửi phím/chuột thật vào Chrome headless; chạy lại được bằng một lệnh |

### Review độc lập (agent `contract-reviewer`, không phải agent đã viết code)

Agent chạy ~75 lượt headless đối kháng của riêng nó và đối chiếu từng yêu cầu. **Không tìm thấy bằng chứng giả.** Các phát hiện và cách xử lý:

| # | Phát hiện | Xử lý | Test hồi quy (fail trên code cũ?) |
|---|---|---|---|
| D1 | So khoảng cách "≤ r" sai do số thực khi lệch gốc tọa độ: 3 đom đóm cách đúng 1.2 m quanh (10,0,10) chỉ nhặt được 1 (hypot = 1.2000000000000002) | So với `r + 1e-6` cho mọi bán kính (pickup, interact, pulse, hit, safe) | có, fail trên code cũ |
| D2 | Cờ CLI lạ không có giá trị (`--verbose`) làm thoát mã 1, trái với giả định 14 | Bỏ qua cờ lạ, chỉ cảnh báo | có, fail trên code cũ |
| D3 | `--ticks=5` không được nhận | Hỗ trợ dạng `--key=value` | có, fail trên code cũ |
| R-a | Scenario cả 5 đèn sáng sẵn thì không bao giờ thắng | Kiểm tra "mọi đèn sáng" cuối mỗi bước → thắng ở tick 1 | có, fail trên code cũ |
| R-b | Đèn dựng với `deposited: 5` mà không có `lit` thì không bao giờ sáng | Đèn đầy thì coi là sáng (không sự kiện, không điểm) | có, fail trên code cũ |
| R-c | Bóng Mực đặt trong vùng an toàn vẫn nằm trong đó ở snapshot 0 | Đẩy ra ngay khi dựng scenario | có, fail trên code cũ |
| R-d | Scenario `flames: 0` vẫn chơi tiếp | Thua `no_flames` ở bước đầu | có, fail trên code cũ |
| Yếu | Test so `score: r.end.score` với chính nó; test sáng tạo chỉ grep mã nguồn; proof s05 dùng `>= 90` | Sửa: điểm tính từ số sự kiện; so đầu ra CLI với game `creative:false` (và khác `creative:true`); `=== invuln_s × 60` | |
| Giữ nguyên | `carried` > sức chứa được chấp nhận; Bóng Mực đang choáng không gây sát thương; snapshot có thêm mảng `motes`; pulse không trúng ai vẫn tốn ánh sáng; đom đóm rơi thì mất; thưởng dùng `floor(time_left)` | Đã ghi trong giả định; đổi nếu ticket sau nói khác | |
| Ghi chú | Phím D gửi `move x = −1` (vì camera ở yaw 0 nhìn về +Z nên phải màn hình là −X) | Đúng hình học, chỉ ảnh hưởng GUI; headless không đổi | |

Đầu ra của mọi scenario cũ trong `runs/` và file inputs của autopilot **không đổi một byte** sau khi sửa.

### Cần chỉnh cho phase sau
- Khi ticket mới đổi luật: cập nhật `phase-N.md` trước, rồi test, rồi code.
- Chạy agent `contract-reviewer` (không phải agent đã viết code) trước khi gắn tag.
