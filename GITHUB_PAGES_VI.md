# GitHub Pages cho BilaBot2 (frontend) + Cloudflare Worker (API)

## Vì sao github.io trước đây không cập nhật?

`apps/dsh-edge/src/public-chat-page.ts` chỉ được Worker build, **không tự xuất bản** lên GitHub Pages. Nay có bộ tệp tĩnh chính xác tại `index.html`, `docs/index.html`, `docs/public/app.js`, và `docs/public/cvnss.js`.

## Bật GitHub Pages

Vào repository **xulytiengviet/Bilabot2 → Settings → Pages → Build and deployment**.
Chọn **Source: Deploy from a branch** và sau đó:
- **Branch:** `main`
- **Folder:** `/(root)` (khuyến nghị) **hoặc** `/docs`
- **Save**

Cả hai lựa chọn đều được hỗ trợ. Khi GitHub xuất bản thành công, mở:
**https://xulytiengviet.github.io/Bilabot2/**

Nếu Pages đã cấu hình `main/(root)` hoặc `main/docs`, không cần chỉnh lại; commit có giao diện mới sẽ được build và xuất bản theo cấu hình hiện tại. Nếu Source đang là **GitHub Actions**, cần thiết lập workflow Pages riêng hoặc chuyển sang **Deploy from a branch** như trên.

## Liên kết với API Cloudflare

Giao diện GitHub Pages gửi câu hỏi tới **`https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/chat`** và đọc model/trạng thái ở `/api/public/config`. API Worker chỉ thêm header CORS cho origin **`https://xulytiengviet.github.io`**, không cho phép chia sẻ credential và không mở các route admin. Lịch sử lưu ở `localStorage` của trình duyệt; tuyệt đối không đặt `DEEPSEEK_API_KEY` vào frontend.

Tại Cloudflare: Worker **bilabot2** → **Settings → Variables and Secrets**, nhập `DEEPSEEK_API_KEY` (Secret) và `DSH_EDGE_ACCESS_KEY` (Secret). Model `deepseek-flash` cố định tại Wrangler vars. Không chia sẻ API key trong issue, log hoặc chat.

**Riêng tư:** Trình duyệt lưu history trong origin `https://xulytiengviet.github.io`, nên tất cả các dự án GitHub Pages dưới cùng hostname có thể dùng chung vùng localStorage theo chính sách same-origin. Dữ liệu không được gửi cho server lưu lịch sử, nhưng câu hỏi/chút lịch sử ngữ cảnh được chuyển đến DeepSeek để phản hồi. Nếu cần cách ly lưu trữ giữa nhiều dự án, ưu tiên custom domain riêng cho BilaBot2.

## Duy trì đồng bộ

Khi sửa trang `apps/dsh-edge/src/public-chat-page.ts` hoặc Converter:
```bash
node scripts/sync-bilabot-pages.mjs
node scripts/sync-bilabot-pages.mjs --check
git add index.html docs/index.html docs/public .nojekyll docs/.nojekyll
git commit -m "chore(pages): sync BilaBot2 UI"
git push
```
GitHub Pages tự cập nhật khi commit thay đổi các tệp được xuất bản.
