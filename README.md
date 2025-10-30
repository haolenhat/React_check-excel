# Check Excel (React + Vite + TS)

Ứng dụng upload Excel, hiển thị bảng, lọc SĐT 10 số, tìm theo tên/SĐT.

## Chạy dự án

```bash
npm install
npm run dev
# Build
npm run build
npm run preview
```

## Ghi chú
- App hiện tự động lấy tất cả file trong `src/data/**/*.{xlsx,xls}` (không cần sửa code).
- Chỉ cần copy file vào `src/data/` rồi chạy/rebuild app.
- Yêu cầu các file có cấu trúc cột giống nhau.
- Tab “Tất cả” và “SĐT sai” để xem toàn bộ hoặc chỉ các dòng có SĐT không hợp lệ.
- Nút “Xuất Excel (dữ liệu đang hiển thị)” sẽ tải xuống 1 file Excel chứa đúng dữ liệu bạn đang xem (đã áp dụng tìm kiếm/lọc/tab).

