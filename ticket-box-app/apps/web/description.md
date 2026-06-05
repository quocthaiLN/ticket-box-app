# Web App

## Vai trò

`web` là frontend cho hai nhóm người dùng: khán giả và admin/organizer. Team đã chọn React + Vite + React Router.

## Hiện trạng Sprint 1

- Build tool: Vite.
- UI framework: React.
- Routing: React Router.
- Entry HTML: `index.html`.
- Entry React: `src/main.tsx`.
- Layout chung: `src/routes/AppLayout.tsx`.
- Audience routes: `src/routes/audience/`.
- Admin routes: `src/routes/admin/`.
- API client base: `src/lib/api-client.ts`.
- CSS chung: `src/styles/globals.css`.

## Cách đọc folder này

1. Đọc `package.json` để biết scripts và dependency.
2. Đọc `vite.config.ts` để hiểu cấu hình dev server/build.
3. Đọc `index.html` để thấy DOM root.
4. Đọc `src/main.tsx` để xem toàn bộ route tree.
5. Đọc `src/routes/AppLayout.tsx` để hiểu layout/nav chung.
6. Đọc `src/routes/audience/` cho luồng khán giả.
7. Đọc `src/routes/admin/` cho luồng admin.
8. Đọc `src/lib/api-client.ts` để hiểu cách gọi API.
9. Đọc `src/styles/globals.css` để chỉnh style nền.

## Quy ước cần giữ

- Route component đặt trong `src/routes/<area>/`.
- Logic gọi backend gom trước trong `src/lib/api-client.ts`, sau này có thể tách theo feature.
- Biến môi trường frontend dùng prefix `VITE_`, ví dụ `VITE_API_BASE_URL`.
- Output `dist/` là build artifact, không commit.

## Ghi chú học thêm

- React Learn: https://react.dev/learn
- Vite Guide: https://vite.dev/guide/
- React Router routing: https://reactrouter.com/start/framework/routing
- React Router browser routers: https://reactrouter.com/api/data-routers/createBrowserRouter
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

## Cần cập nhật ở các sprint sau

- Khi thêm login/register, cập nhật luồng auth frontend.
- Khi Catalog có API thật, cập nhật cách list/detail gọi backend.
- Khi thêm checkout/ticket/admin forms, ghi lại route mới và state management nếu có.
