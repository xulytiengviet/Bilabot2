# BilaBot2 · Trò chuyện thử nghiệm công khai

Nhánh này bổ sung **chế độ Public Chat** độc lập vào `dsh-edge`:

- Không cần đăng nhập để dùng `/`; giao diện tiếng Việt, hỗ trợ điện thoại.
- Mọi người dùng dùng chung **một DEEPSEEK_API_KEY bí mật** và **một DEEPSEEK_MODEL** do chủ Worker cấu hình.
- Lịch sử phiên (tin nhắn, tên phiên) được lưu **chỉ trong localStorage của từng trình duyệt**; có nút xuất JSON và xóa lịch sử.
- Worker chỉ xử lý request rồi gọi DeepSeek; không ghi lời nhắn vào SQLite, Durable Objects, KV, R2 hay analytics ứng dụng.
- Hoàn toàn tách khỏi API Harness nhiều quyền. Với **chế độ Public Chat**, chỉ cần `DEEPSEEK_API_KEY`; nếu không cấu hình `DSH_EDGE_ACCESS_KEY` thì mọi route owner/Harness mặc định trả 404. Khi cần quản trị Harness riêng, chủ website mới thêm secret độc lập, tuyệt đối không dùng API key DeepSeek để đăng nhập.
- Giới hạn 5 yêu cầu / 60 giây trên từng IP và Cloudflare edge location (xấp xỉ). Tắt Workers observability theo cấu hình nhánh; cần kiểm tra thêm account-level request logs, WAF, proxies hoặc nhà cung cấp API để có cam kết riêng tư phù hợp.

## Cloudflare: thiết lập

1. Clone đúng nhánh thay đổi, dùng Node.js >= 22.19 và pnpm 11.7.0. Chạy `pnpm --dir apps/dsh-edge/standalone install --frozen-lockfile` trước, sau đó `pnpm install --frozen-lockfile`. Kiểm tra với `pnpm run check` và chạy `pnpm --filter dsh-edge run deploy:public` để **build từ source chính nhánh này** rồi triển khai chế độ Direct lên Worker `dsh-edge`. Lệnh này dùng Wrangler đã đăng nhập hoặc Cloudflare token trong môi trường; không chạy `npx dsh-edge install` từ npm. Nếu tên Worker đang triển khai khác `dsh-edge`, chạy riêng: `pnpm --filter dsh-edge run bundle:direct && node apps/dsh-edge/scripts/deploy-public.mjs TEN_WORKER`.
2. Đặt `DEEPSEEK_API_KEY` dưới dạng secret trong Cloudflare Workers, không đặt vào `vars` hay HTML. Ví dụ, từ `apps/dsh-edge`: `npx wrangler secret put DEEPSEEK_API_KEY` (cần dùng đúng environment nếu deploy isolated/container).
3. `wrangler.jsonc` đã có `DSH_EDGE_PUBLIC_CHAT=enabled`, `DSH_EDGE_PUBLIC_MAX_TOKENS=1024`, giới hạn 5 lượt / 60 giây và `observability.enabled=false`.
4. `DEEPSEEK_MODEL=deepseek-flash` đã được khai báo trong `wrangler.jsonc` cho Direct, Isolated và Container. Chỉ chủ website có thể chỉnh model; không cho khách đổi model.
5. **Không cần** `DSH_EDGE_ACCESS_KEY` khi chỉ sử dụng trò chuyện công khai. Nếu muốn mở quyền quản trị Harness `/login` và `/owner`, thêm riêng `DSH_EDGE_ACCESS_KEY` (khóa ngẫu nhiên tối thiểu 32 byte). Quản trị key/model công khai vẫn thực hiện ở Cloudflare Dashboard.
6. Kiểm tra `GET /api/public/config` trả về `ready:true`. Mở `/` vào BilaBot không đăng nhập. `/login`, `/owner` trả 404 nếu không cấu hình secret owner riêng.

## Biên riêng tư, bảo mật và chi phí

BilaBot2 không thu thập hoặc lưu trữ **nội dung hội thoại** trong máy chủ ứng dụng ở chế độ Public Chat. Tuy nhiên **nội dung mỗi yêu cầu và một phần lịch sử gần đây được gửi đến DeepSeek để sinh câu trả lời**; các nhà cung cấp cơ sở hạ tầng có chính sách xử lý dữ liệu riêng. Người dùng không nên nhập thông tin cá nhân nhạy cảm. Tắt observability trong mã cấu hình không chắc chắn tắt mọi log cấp tài khoản. CORS / kiểm tra Origin không phải biện pháp ngăn bot; Cloudflare WAF/Turnstile (nếu cho phép), bot protection và budget cap ở nhà cung cấp nên được bật trước khi quảng bá rộng rãi.

Giới hạn dùng Workers rate limiting mang tính **ước lượng theo vị trí**, không phải hạn mức toàn cầu nghiêm ngặt. Nếu có đông người dùng, cần thêm hạn mức chi tiêu từ tài khoản DeepSeek hoặc bộ đếm nghiêm ngặt (đánh đổi với việc lưu metadata tối thiểu). Không định danh ổn định người dùng; IP có thể là IP NAT chia sẻ. Hiện nhánh này chỉ hỗ trợ chat văn bản, không mở tool execution, upload, MCP hay phiên Harness cho khách.

## Kiểm tra nhanh

- Không cookie: `GET /` trả HTML tiếng Việt; `GET /public/app.js` trả script.
- Không cookie: `GET /api/public/config` trả JSON không chứa API key.
- `POST /api/public/chat` với header `Origin` trùng Worker origin và `Content-Type: application/json`; payload `{"messages":[{"role":"user","content":"Xin chào"}]}`.
- Sai Origin bị 403; payload rỗng bị 400; quá 5 lượt có thể bị 429.
- Không cookie và **không có `DSH_EDGE_ACCESS_KEY`**: `GET /api/sessions`, `/login`, `/owner` phải trả 404. Nếu có secret owner riêng: các API owner yêu cầu phiên xác thực, `/login` mở biểu mẫu owner.
- Chạy `pnpm run check` và `pnpm run build` trước khi merge/deploy. **Nhánh chưa được xác nhận CI hay triển khai Cloudflare thực tế**.

## Giới hạn truy cập dashboard

Có quyền xem Dashboard Cloudflare trên máy cá nhân **không tự động cho phép tác nhân ChatGPT trong chat gọi API**. Cần chạy Wrangler bằng máy đã đăng nhập (`npx wrangler login`) hoặc một công cụ có quyền Worker deployment và secrets. Đừng gửi DeepSeek key hoặc Owner key trong hội thoại; điền trực tiếp trong **Cloudflare Dashboard → Workers & Pages → bilabot2 → Settings → Variables and Secrets → Add → Secret → Deploy**. Chỉ có **`DEEPSEEK_API_KEY`** là bắt buộc cho website công khai. `DSH_EDGE_ACCESS_KEY` hoàn toàn tùy chọn, chỉ dành cho Harness quản trị riêng.

## Giao diện sáng và biểu tượng CVNSS4.0

- Giao diện BilaBot mặc định sáng, tiếng Việt, thân thiện điện thoại; xây theo bố cục mẫu `Bilabot.html` do chủ website cung cấp, nhưng **không** sao chép khóa OpenRouter có trong HTML mẫu.
- Biểu tượng bộ não **CVNSS4.0** mang ý nghĩa nhận diện. Engine sinh câu trả lời thực tế vẫn là **DeepSeek**, dùng `DEEPSEEK_MODEL` trong cấu hình Cloudflare và secret `DEEPSEEK_API_KEY`.
- Câu hỏi gửi tới DeepSeek bằng Unicode; câu trả lời hiển thị chuẩn Unicode NFC. Có thể mở **Xem cách mã hóa câu trả lời bằng CVNSS4.0** để hiển thị cách biểu diễn văn bản bằng bản converter v5.0.0-audit-safe; **không phải** suy nghĩ nội bộ/chain-of-thought của mô hình.
- Converter nguồn gốc từ tệp đính kèm `cvnss4_0_converter.pro.v5_0.audit_safe`, selfTest đạt 23 bài kiểm tra. Mã chuyển đổi được phục vụ từ `/public/cvnss.js` cùng origin và chạy ở trình duyệt.
- Phần chữ CVNSS4.0 có trường hợp mơ hồ đảo ngược, nên không khẳng định song ánh với mọi chuỗi tiếng Việt. Giữ câu trả lời gốc Unicode làm dữ liệu chính.
- Trình duyệt chỉ gọi `GET /api/public/config` để lấy tên model và trạng thái key (không có key), `POST /api/public/chat` để sinh câu trả lời. Không gọi OpenRouter hoặc lưu câu hỏi trên DB ứng dụng.
- Quyền quản trị model/key nằm tại **Cloudflare > Workers & Pages > bilabot2 > Settings > Variables and Secrets**. Các route `/login` và `/owner` mặc định không hoạt động nếu không thêm `DSH_EDGE_ACCESS_KEY` riêng.
- Nếu trước đây đã sử dụng HTML mẫu công khai, hãy **revoke/rotate OpenRouter key** cũ vì HTML chứa khóa trực tiếp; tuyệt đối không dùng lại khóa đó ở Cloudflare.

## Honeypot riêng tư (theo tài liệu mẫu, không ghi nhật ký IP)

- Mồi nhận diện các đường dẫn quét rõ ràng: `/.env`, `/.git/config`, `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/phpmyadmin`, `/admin-secret-panel`, `/api/internal/debug`. Luôn trả `404 Not Found`, `Cache-Control: no-store`.
- Bẫy và chat chia sẻ **rate limiter đã có sẵn** `PUBLIC_CHAT_RATE_LIMITER = 5/60s`. Khi quét trúng, Worker tiêu thụ tối đa năm lượt bộ đếm của IP đó, khiến các yêu cầu chat tiếp theo có thể tạm nhận `429` khoảng một phút. Đây là giới hạn xấp xỉ theo Cloudflare colo, **không phải IP ban toàn mạng**.
- IP chỉ dùng nội bộ để tạo khóa HMAC bằng secret DeepSeek. Không lưu danh tính, IP, User-Agent, prompt, chi tiết truy vấn; không `console.log`, không D1/KV/R2, không webhook và không cần token Cloudflare bổ sung.
- Bẫy không phạt lượt tải nhúng từ website khác (`Sec-Fetch-Site: cross-site`), giảm nguy cơ kẻ khác lợi dụng bẫy để chặn nhầm người dùng.
- **Không tạo WAF Skip Rule** cho honeypot. Nếu WAF chặn trước Worker thì đó là lớp bảo vệ có ích, không phải lỗi. Không sử dụng login giả/tarpit, không chặn IP vĩnh viễn.
- Tài liệu mẫu đề nghị `period = 3600` nhưng Cloudflare Workers Rate Limiting hiện chỉ hỗ trợ `10` hoặc `60` giây. Dùng bộ đếm 60 giây đã tồn tại, không cần thêm binding.
- Dù ứng dụng không thu thập nhật ký, Cloudflare hoặc DeepSeek vẫn có thể xử lý metadata theo chính sách riêng. Người dùng được khuyến nghị không nhập thông tin nhạy cảm.
