# Báo cáo biến môi trường Payment Gateway

Tài liệu này giải thích các biến môi trường được đề xuất cho hai cổng thanh toán. Trong mã hiện tại, cấu hình được đọc tại `config/env.ts` từ file `.env` ở thư mục gốc monorepo.

## VNPAY

| Biến | Ý nghĩa và mục đích |
| --- | --- |
| `VNPAY_TMN_CODE` | Mã định danh website/merchant do VNPay cấp (Terminal Merchant Code). Hệ thống đưa giá trị này vào yêu cầu tạo thanh toán để VNPay xác định tài khoản nhận tiền và cấu hình tích hợp tương ứng. `vnpay_tmn_code` chỉ là giá trị minh hoạ; môi trường thật phải dùng mã do VNPay cấp. |
| `VNPAY_HASH_SECRET` | Khóa bí mật dùng để tạo và kiểm tra chữ ký của tham số thanh toán (HMAC/hash). Nó bảo vệ yêu cầu gửi sang VNPay và dữ liệu trả về khỏi bị sửa đổi. Không đưa vào mã nguồn, client hoặc log; dùng secret riêng cho từng môi trường. |
| `VNPAY_URL` | Địa chỉ trang thanh toán mà người dùng được chuyển hướng tới sau khi hệ thống tạo bộ tham số thanh toán. Giá trị `https://test-payment.vnpay.vn/vpcpay.html` hướng đến môi trường kiểm thử; production phải thay bằng endpoint production được VNPay cung cấp. |
| `VNPAY_RETURN_URL` | URL frontend nhận kết quả khi người dùng hoàn tất hoặc hủy thao tác trên trang VNPay và được chuyển hướng về hệ thống. Route này phục vụ trải nghiệm người dùng; backend vẫn cần xác thực chữ ký và/hoặc đối soát giao dịch, không được chỉ dựa vào query string tại return URL. |
| `VNPAY_BULKHEAD_LIMIT` | Số request gọi VNPay được phép đang xử lý đồng thời. Giới hạn này tách tải của VNPay khỏi phần còn lại của API: khi đạt ngưỡng, request mới bị từ chối/giới hạn thay vì làm cạn tài nguyên server. Giá trị `20` phù hợp làm điểm khởi đầu và cần điều chỉnh theo lưu lượng, timeout và năng lực hạ tầng. |

## MoMo

| Biến | Ý nghĩa và mục đích |
| --- | --- |
| `MOMO_PARTNER_CODE` | Mã định danh merchant/đối tác do MoMo cấp. Nó được gửi trong yêu cầu tạo giao dịch để MoMo chọn đúng tài khoản tích hợp. `momo_partner_code` chỉ là giá trị minh hoạ. |
| `MOMO_HASH_SECRET` | Khóa bí mật dùng để ký và kiểm tra chữ ký của dữ liệu trao đổi với MoMo. Phải lưu như secret, không commit hay gửi xuống frontend. |
| `MOMO_ENDPOINT` | Endpoint API tạo yêu cầu thanh toán MoMo. `https://test-payment.momo.vn/v2/gateway/api/create` là môi trường test; chuyển sang endpoint production khi triển khai thật. |
| `MOMO_RETURN_URL` | URL frontend mà MoMo điều hướng người dùng về sau luồng thanh toán. Đây chỉ là kết quả hiển thị cho người dùng; trạng thái đơn hàng phải được backend xác nhận bằng IPN/webhook có chữ ký hoặc API query của MoMo. |
| `MOMO_BULKHEAD_LIMIT` | Số lần gọi MoMo được phép chạy đồng thời. Nó ngăn sự cố/chậm trễ từ MoMo chiếm hết worker hoặc connection của API. Giá trị `20` là mức khởi đầu, cần theo dõi tỷ lệ timeout và tải thực tế để tinh chỉnh. |

## Lưu ý về tên biến trong mã hiện tại

Hai tên MoMo trong danh sách được yêu cầu chưa khớp với `config/env.ts` hiện tại:

| Tên trong yêu cầu | Tên mã hiện tại đang đọc | Ghi chú |
| --- | --- | --- |
| `MOMO_HASH_SECRET` | `MOMO_SECRET_KEY` | Mã hiện tại dùng `MOMO_SECRET_KEY` cho khóa bí mật ký request. Nếu giữ `MOMO_HASH_SECRET`, cần sửa cấu hình và phần ký request cùng lúc; nếu không, biến này sẽ không có tác dụng. |
| `MOMO_RETURN_URL` | `MOMO_REDIRECT_URL` | Mã hiện tại dùng `MOMO_REDIRECT_URL` làm URL chuyển hướng người dùng. `MOMO_RETURN_URL` sẽ không được đọc nếu chưa bổ sung mapping. |

Ngoài URL chuyển hướng, mã hiện tại còn dùng `MOMO_ACCESS_KEY`, `MOMO_IPN_URL` và các endpoint đối soát riêng. Với cả hai gateway, secret chỉ nên có ở backend và trạng thái thanh toán chỉ được cập nhật sau khi kiểm tra chữ ký/đối soát đáng tin cậy.
