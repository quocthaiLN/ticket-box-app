# 1 Thiết kế test case cho đặt vé - Để đó 

- Kết quả: Đặt trong file order.md trong blueprint
    - Yêu cầu:
        - Testcase gồm tên (ngắn gọn), mô tả (ngắn gọn), đầu ra mong đợi (ngắn gọn)
        - Đặc biệt phải đảm bảo đủ các trường hợp nhưng đừng quá nhuyễn tầm 1-3 testcase cho mỗi loại là đc (cái nào khó thì 4 thôi)
- Tham khảo trong blueprint: 
    - require.md
    - trong specs/ và api-design/ liên quan: ticket-inventory.md, order-checkout.md
    - Ngoài ra cũng cần phải xem mã nguồn (QUAN TRỌNG) -> mã nguồn đã thực sự triển khai ntn trong api-server như thế nào

# 2 Làm quen với K6

- Tôi đã cài đặt K6 bằng docker
- Yêu cầu: 
    - Viết một test đơn giản cho luồng đặt vé n vé nhưng có 80k request đặt vé tại file order.ts trong tests/order
    - Đọc seed để trong seed.sql trong packages/schema/seed.sql để dễ test
    - Đọc mã nguồn của API modules/orders để hiểu mã nguồn triển khai
