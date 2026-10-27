# BilaBot2 · Cloudflare Workers AI Free · Không cần API Key

## Kiến trúc sản xuất

- Giao diện tĩnh: **https://xulytiengviet.github.io/Bilabot2/** và trang Worker; không cần Gmail/đăng nhập.
- AI nội bộ của Cloudflare: **Workers AI Binding `AI`** từ `wrangler.jsonc` (không có khóa API của DeepSeek hay OpenRouter, không gửi request trực tiếp đến API hai bên).
- Model mặc định: **`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`**, mô hình DeepSeek-R1 **chưng cất** do Cloudflare phục vụ (không phải DeepSeek V4 bản trả phí).
- **10 câu hỏi thành công tổng cộng trên mỗi IP**: không đặt lại theo ngày, không đặt lại khi tải lại trang hoặc xóa lịch sử; người dùng sau NAT/chung Wi-Fi có thể chia sẻ hạn mức. IP có thể thay đổi, vì vậy đây là giới hạn kỹ thuật, không định danh người thật tuyệt đối.
- **5 yêu cầu / 60 giây / IP (xấp xỉ tại edge)**: giữ `PUBLIC_CHAT_RATE_LIMITER`; các lượt bị từ chối theo phút không trừ 10 câu hỏi.
- Chỉ trừ 1 câu hỏi **sau khi model trả lời thành công**. Trong khi model xử lý, hệ thống đặt một reservation; lỗi từ model, hết neurons hoặc lỗi kết nối được hoàn lại. Reservation quá hạn 120 giây được dọn khi IP gửi lần tiếp theo. Do đó tránh nhiều yêu cầu song song vượt ngưỡng 10.
- Nội dung trả lời luôn chuẩn Unicode NFC; người dùng có thể xem mã hóa CVNSS4.0 v5.0.0 audit-safe, nhưng không hiển thị chain-of-thought của model.
- Lịch sử trò chuyện được lưu ở localStorage phía trình duyệt, không ghi nội dung chat lên Durable Object.

## Triển khai Cloudflare

Repository: `xulytiengviet/Bilabot2`. Worker đã liên kết: `bilabot2`.

1. Kiểm tra GitHub CI build nhánh `main`, `pnpm run build`. Deploy command giữ nguyên:
   ```bash
   node apps/dsh-edge/scripts/deploy-public.mjs bilabot2
   ```
2. `apps/dsh-edge/wrangler.jsonc` tạo **`"ai": {"binding":"AI"}`** (bao gồm các environment riêng), binding **`PUBLIC_VISITOR_QUOTA`** SQLite Durable Object, migration **`v2-public-visitor-quota`** và `PUBLIC_CHAT_RATE_LIMITER` 5/60 giây.
3. **Không phải thêm `DEEPSEEK_API_KEY` hay `OPENROUTER_API_KEY`.** Nếu secret cũ vẫn tồn tại trong Worker, frontend công khai không sử dụng chúng; có thể thu hồi sau khi xác nhận không còn sản phẩm khác cần.
4. Truy cập `https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/config`. Mong đợi `provider: "workers-ai", ready: true, maxQuestionsPerIp: 10`. `ready` nghĩa là ba binding đã hiện diện, **không phải bằng chứng** còn ngân sách neurons.
5. Gửi thử một câu tại GitHub Pages hoặc Workers; kết quả gồm `remaining` (9 sau câu trả lời đầu tiên từ một IP chưa từng dùng quota).
6. AI Free có 10.000 neurons/ngày trên **tài khoản**, không phải mỗi người dùng. Reset 00:00 UTC tương ứng 07:00 Việt Nam. Khi hạn mức hết, câu hỏi không bị trừ vào quota và người dùng nhận thông báo thân thiện.

## Bộ đếm 10 câu / IP bền vững

`PublicVisitorQuota` sử dụng **một SQLite-backed Durable Object** làm bộ đếm nhất quán:
- Trong bộ nhớ của chính DO, phát sinh một khóa HMAC ngẫu nhiên và lưu bền vững trong storage; Worker gửi IP nội bộ đến DO để tính mã HMAC.
- Bảng SQLite chỉ lưu mã HMAC IP, số câu đã trả lời thành công và token reservation ngắn hạn. **Không lưu IP thô, User-Agent, văn bản câu hỏi, API key, response.**
- Các bước: kiểm tra minute limiter → reserve slot DO → gọi AI → finish thành công và trừ 1 slot, hoặc hủy reservation khi lỗi.
- Nếu thiếu `CF-Connecting-IP`, DO/AI binding, hoặc rate limiter thì từ chối yêu cầu (fail closed), không mở lối hỏi không giới hạn.
- DO hiện tại là **một đối tượng toàn cục** để giữ một HMAC salt và các bộ đếm; cách này đơn giản/đúng cho dự án nhỏ nhưng có giới hạn thông lượng khi số người dùng tăng. Nên cân nhắc phân vùng được cấp khóa bằng salt khi mở rộng.
- Hạn mức gắn với IP nên IPv4 NAT ảnh hưởng nhiều người; IPv6 privacy rotation có thể vượt qua quota. Nếu dùng nhiều domain GitHub Pages cùng origin, localStorage không cách ly theo path.
- Không có nút công khai để reset bộ đếm. Reset quota bằng thay namespace Durable Object là thao tác phá dữ liệu, **không thực hiện tùy tiện**.

## Honeypot

Bẫy `/.env`, `/.git/config`, `/wp-admin`, `/phpmyadmin`, `/api/internal/debug` trả 404. Bẫy chia sẻ khóa HMAC và minute limiter để giới hạn tạm thời hành vi quét; không trừ 10 câu hỏi cho việc thăm dò.

**Không** tự động chặn IP vĩnh viễn, không ghi nhật ký truy cập riêng, không WAF Skip rule, không webhook, không D1. WAF/Bot Fight Mode của Cloudflare vẫn hoạt động độc lập.

## Ranh giới bảo mật và chi phí

- Origin/CORS là biện pháp bảo vệ trình duyệt, không xác thực người dùng. Trình duyệt không thể thấy binding hay nội dung HMAC.
- Khi không đặt `DSH_EDGE_ACCESS_KEY`, tất cả tuyến Harness quản trị bị vô hiệu hóa bằng 404. Nếu cần Harness riêng, dùng secret owner độc lập.
- Dù BilaBot2 không lưu nội dung hội thoại, Cloudflare xử lý prompt để sinh nội dung, và có thể xử lý metadata theo chính sách dịch vụ.
- Workers AI Free và Durable Objects SQLite đều có hạn mức theo tài khoản; phần vượt hạn mức sẽ từ chối nếu dùng Free. Hãy theo dõi **Cloudflare Dashboard → Workers AI → Usage**, **Workers & Pages → bilabot2**, và tránh kỳ vọng phục vụ miễn phí vô hạn.
- Bộ đếm quota là dữ liệu pseudonymous bền vững có thể thuộc phạm vi dữ liệu cá nhân theo luật địa phương; cần thông báo quyền riêng tư phù hợp và cân nhắc chính sách xóa dữ liệu.

## Tài liệu chính thức

- https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/
- https://developers.cloudflare.com/ai/models/%40cf/deepseek-ai/deepseek-r1-distill-qwen-32b/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
