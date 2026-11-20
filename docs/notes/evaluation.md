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

## Phase 2 (Ticket-02 tự đặt)

**Kết quả:** `npm test` 54/54 · `npm run proof -- 2` PASS (13 dòng, cộng dồn Phase 1) · chơi thử GUI 19/19 (thêm 5 kiểm tra Đêm 2) · autopilot thắng 20/20 ở cả hai đêm. Chi tiết: [docs/proof/phase-2/REPORT.md](../proof/phase-2/REPORT.md).

| Hạng mục | Trạng thái |
|---|---|
| P2-1…P2-9 (xem [phase-2.md](phase-2.md)) | Đạt, mỗi mục có test hoặc dòng proof |
| Hỏng phase trước? | Không, ngoài đúng phần CR-1 thay thế. Reviewer so đầu ra Đêm 1 của commit `ab2de57` với HEAD: giống từng byte (bỏ 2 trường mới `night`, `kind`) trên s01–s06, s08 và 6 đêm mặc định; chỉ 2 lượt chạy khác, đúng chỗ CR-1 dự đoán |
| Test Phase 2 có thật sự bắt được thiếu sót? | Chạy bộ test Phase 2 trên code Phase 1: 10/12 fail |

### Thay đổi yêu cầu (CR-1)
Đã ghi lý do và bảng test cũ bị sửa trong [phase-2.md](phase-2.md); giả định 7 của Phase 1 được gạch và trỏ sang CR-1. **Rủi ro (reviewer R1):** CR-1 đổi hành vi Đêm 1 so với contract v1.0. Nếu có bộ test ẩn của giảng viên cho Phase 1 kiểm "đèn chưa sáng vẫn đẩy Bóng Mực" thì sẽ trượt. Vì ticket ghi rõ là thay thế, và buổi lab không có giảng viên, tôi giữ CR-1. Nếu có ticket thật mâu thuẫn, cách an toàn là chỉ áp CR-1 cho Đêm 2.

### AI sai ở đâu
| Lỗi | Phát hiện | Sửa |
|---|---|---|
| Test P2-4 cho nhân vật đứng yên, bị giết trước khi con Bóng Mực thứ 3 sinh ra | Test đỏ ("spawned 2"), lỗi ở test | Cho nhân vật đứng trong vòng của một đèn đã sáng |
| Script sửa file bằng chuỗi thay thế không khớp (dấu xuống dòng, ký tự thoát) nên dừng giữa chừng | Script báo "nf" và không ghi file | Viết patch ra file riêng; luôn kiểm tra bằng `grep` sau khi sửa |
| Test "Bóng Mực bị choáng bị đẩy ra khi đèn sáng" đặt Bóng Mực ở chỗ mà cú tỏa sáng đã đẩy nó ra khỏi vòng từ trước | Test đỏ, lỗi ở test | Tính lại vị trí sau cú đẩy (z = 27.5, cách đèn 2.5 m) |
| Hook test-gate báo đỏ liên tục khi sửa nhiều chỗ trong `sim.js` | Hook (đúng như thiết kế: đang TDD) | Không tắt hook; hoàn tất từng nhóm sửa rồi chạy lại |

### Review độc lập Phase 2
Không có lỗi code. Đã bổ sung theo góp ý: `--night 3` phải đúng mã 1; kiểm vị trí cả 6 đèn; con thứ 6 là `big` và tối đa 6 con; Bóng Mực đang choáng vẫn bị đẩy ra khi đèn sáng; bán kính chạm của Bóng Mực Lớn theo đường chéo lệch gốc; dòng proof CR-1 kiểm thêm việc Bóng Mực thật sự vào trong vòng 4 m.

## Phase 3 (Ticket-03 tự đặt: tạm dừng + lướt)

**Kết quả:** `npm test` 65/65 · `npm run proof -- 3` PASS (gồm dòng hồi quy so với tag `phase-2`: 21/21 giống hệt) · chơi thử GUI 22/22 (thêm P tạm dừng, P tiếp tục, Shift lướt bằng phím thật). Chi tiết: [docs/proof/phase-3/REPORT.md](../proof/phase-3/REPORT.md).

| Hạng mục | Trạng thái |
|---|---|
| P3-1…P3-9 | Đạt |
| Hỏng phase trước? | Không: `tools/regress.mjs phase-2` cho 21/21 kịch bản giống từng byte (bỏ trường mới `paused`). Reviewer thử cố ý gây lỗi trong bản sao thì công cụ báo đúng là khác (9/21, 0/21) |

### AI sai ở đâu
| Lỗi | Phát hiện | Sửa |
|---|---|---|
| Chèn `'\n'` vào template qua heredoc + `node -e` làm sinh ký tự xuống dòng thật giữa regex, `proof.js` lỗi cú pháp | `node --check` | Sửa theo số dòng bằng script ở file riêng; thêm thói quen `node --check` sau mỗi patch |
| `regress.mjs` chạy cả kịch bản `p3-*` dùng tính năng mới nên báo FAIL giả | Đọc dòng proof bị FAIL | Thêm `--skip=p3-` |
| `regress.mjs` dùng lại file kết quả của ca trước khi cả hai bản cùng lỗi (có thể báo SAME sai) | Review độc lập | Xóa file trước mỗi lần chạy |
| Test P3-7 so HEAD với chính HEAD; test hồi chiêu không chạm đúng mốc | Review độc lập | P3-7 dựa vào dòng regress trong proof (ghi rõ); thêm test đúng mốc hồi chiêu, tạm dừng giữa lúc lướt, hồi chiêu đứng yên khi dừng |

### Điểm mơ hồ còn lại (ghi trong giả định 5–6 của phase-3.md)
Nút nhấn đúng tick bỏ tạm dừng vẫn có tác dụng; lướt không phụ thuộc độ lớn cần điều khiển; `tick` (gồm tick dừng) dùng cho sự kiện, snapshot và `end.ticks`.

## Phase 4 (Ticket-04 tự đặt: hiệu năng, ổn định, chiến dịch, phát hành)

**Kết quả:** `npm test` 70/70 · `npm run proof -- 4` PASS, 19 dòng cộng dồn 4 phase (gồm bench, fuzz, hồi quy so với `phase-2` và `phase-3`) · chơi thử GUI 25/25 trên **cả bản dev lẫn bản build phát hành** · fuzz 300 ca: 0 crash, 0 vi phạm. Chi tiết: [docs/proof/phase-4/REPORT.md](../proof/phase-4/REPORT.md).

| Hạng mục | Trạng thái |
|---|---|
| P4-1 hiệu năng | Đạt: một đêm đầy đủ qua CLI ~0.3–0.5 s (ngưỡng 2 s); bước gameplay ~0.003–0.005 ms (ngưỡng 0.5 ms). Bench giờ bắt buộc đêm phải kết thúc đúng ở bình minh |
| P4-2 ổn định | Đạt. Fuzz phủ: 155 ca Đêm 2, 128 có tạm dừng, 172 có lướt, 38 có Bóng Mực Lớn, 28 ca thắng, đủ 8 loại file hỏng |
| P4-3 bộ kiểm bắt lỗi thật | Đạt: 18 kiểu làm hỏng đầu ra đều bị bắt (test) |
| P4-4 kỷ lục, "Sang Đêm 2" | Đạt (playtest). Nút "Sang Đêm 2" được kiểm qua preset `nearwin` (không chơi trọn Đêm 1 lần hai để tiết kiệm thời gian) |
| P4-5 bản build | Đạt: test build + chơi thử 25/25 trên `dist/web`; zip giải nén bằng Windows khớp từng file |
| P4-6 không hồi quy | Đạt: `regress phase-3` giống hệt |
| P4-7 video, retro, README | Video quay tự động (bot chơi, có ghi rõ); retro và README đã cập nhật |

### Review độc lập Phase 4
Không có lỗi chức năng. Các điểm yếu đã sửa:
| Điểm yếu | Sửa |
|---|---|
| Bộ kiểm bất biến bỏ sót: `carried` vượt sức chứa, `flames` tăng lại, `time_left_s` âm hoặc lệch, sai thứ tự event/snapshot, id trùng, `state`/`kind` lạ, đổi đêm, đèn biến mất, dữ liệu event sai | Thêm tất cả, kèm test cho từng kiểu |
| Cài lỗi "đồng hồ vẫn chạy khi tạm dừng" vào sim thì fuzz vẫn PASS | Thêm bất biến `time_left_s + sim_tick/60` không đổi; có test mô phỏng đúng lỗi này |
| Fuzz không có ca thắng; loại hỏng `tick-order` không được sinh | Cứ 10 ca có 1 ca gần thắng (28 ca thắng); các loại hỏng được sinh luân phiên |
| Bench PASS cả khi đêm không tới bình minh | Bắt buộc `end.state = lost` và lý do `dawn` |
| Chưa chứng minh bản build chạy dưới thư mục con trong trình duyệt | Chưa làm: reviewer đã kiểm bằng HTTP (mọi file 200); ghi nhận là hạn chế |

### AI sai ở đâu
| Lỗi | Phát hiện | Sửa |
|---|---|---|
| Video lần 1: tab ghi hình mở chung cửa sổ nên tab game bị xuống nền, quay ra màn đen 12 s | Tự kiểm khung hình (giải mã video, đo độ sáng) | Mở tab ghi hình thành cửa sổ riêng, tắt cơ chế "occlusion" của Windows |
| Video lần 2: trình phát chỉ thấy 12.4 s | Đọc cấu trúc MP4: `MediaRecorder` chỉ ghi độ dài phân đoạn đầu vào `mvhd` | `tools/mp4-fix-duration.mjs` ghi lại độ dài thật |
| Video lần 2: cả video là slide mở đầu đứng yên | Xem ảnh trích từ nhiều mốc | Screencast dừng sau khi chuyển trang → khởi động lại sau mỗi lần chuyển trang |
| Video lần 3–4: vẫn đứng yên ở slide mở đầu | Xem ảnh trích | Screencast bỏ hẳn, thay bằng chụp màn hình liên tục; tab ghi hình kẹt khi nhận hai ảnh giống hệt (`img.src` không đổi thì không có `onload`) → bỏ qua ảnh trùng |
| Công cụ kiểm video tua sai nên luôn ra khung đầu | So với cách phát liên tục 4× | Kiểm bằng cách phát liên tục và chụp khi đang phát; video cuối (131 s) có đủ cảnh: slide, Đêm 1, Đêm 2, slide bằng chứng |
