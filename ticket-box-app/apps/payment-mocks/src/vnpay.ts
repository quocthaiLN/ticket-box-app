import { createHmac } from 'node:crypto';
import { Router } from 'express';
import { env } from '@ticketbox/config';
import { applyFault, type ControlStore } from './control.js';

interface VnpayQueryBody {
  vnp_RequestId?: string;
  vnp_Version?: string;
  vnp_Command?: string;
  vnp_TmnCode?: string;
  vnp_TxnRef?: string;
  vnp_OrderInfo?: string;
  vnp_TransactionDate?: string;
  vnp_CreateDate?: string;
  vnp_IpAddr?: string;
  vnp_SecureHash?: string;
}

function encodeVnpValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function signedReturnUrl(
  returnUrl: string,
  source: Record<string, string>,
  responseCode: '00' | '24',
): string {
  const params: Record<string, string> = {
    ...source,
    vnp_ResponseCode: responseCode,
    vnp_TransactionStatus: responseCode,
    vnp_TransactionNo: responseCode === '00' ? String(Date.now()) : '0',
  };
  delete params.vnp_SecureHash;

  const signData = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeVnpValue(params[key])}`)
    .join('&');
  const secureHash = createHmac('sha512', env.vnpay.hashSecret)
    .update(signData, 'utf8')
    .digest('hex');
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}${signData}&vnp_SecureHash=${secureHash}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function expectedSignature(b: VnpayQueryBody): string {
  const hashData = [
    b.vnp_RequestId,
    b.vnp_Version,
    b.vnp_Command,
    b.vnp_TmnCode,
    b.vnp_TxnRef,
    b.vnp_TransactionDate,
    b.vnp_CreateDate,
    b.vnp_IpAddr,
    b.vnp_OrderInfo,
  ].join('|');
  return createHmac('sha512', env.vnpay.hashSecret).update(hashData, 'utf8').digest('hex');
}

/** Mock of VNPay's QueryDR POST /merchant_webapi/api/transaction — validates real HMAC-SHA512. */
export function vnpayRouter(control: ControlStore): Router {
  const router = Router();

  // Endpoint chỉ dành cho mock mode: tạo network boundary trước khi API ký URL.
  router.post('/prepare', async (req, res) => {
    const { fail } = await applyFault(control.get('vnpay'));
    if (fail) {
      res.status(502).json({ status: 'failed', orderId: req.body?.orderId });
      return;
    }

    res.json({ status: 'ready', orderId: req.body?.orderId });
  });

  // Trang thanh toán giả lập để URL do VnpayGateway tạo ra có đích đến thật.
  // /prepare mới là network boundary dùng để báo outage về frontend trước redirect.
  router.get('/vpcpay.html', async (req, res) => {
    const { fail } = await applyFault(control.get('vnpay'));
    if (fail) {
      res.status(502).send('VNPay mock is unavailable');
      return;
    }

    const params = Object.fromEntries(
      Object.entries(req.query)
        .filter(([key, value]) => key.startsWith('vnp_') && typeof value === 'string')
        .map(([key, value]) => [key, value as string]),
    );
    const returnUrl = params.vnp_ReturnUrl;
    if (!returnUrl || !params.vnp_TxnRef || !params.vnp_Amount) {
      res.status(400).send('Missing VNPay checkout parameters');
      return;
    }

    const successUrl = signedReturnUrl(returnUrl, params, '00');
    const cancelUrl = signedReturnUrl(returnUrl, params, '24');
    res.type('html').send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>VNPay Mock</title></head>
<body style="font-family:system-ui;max-width:520px;margin:64px auto;padding:24px">
  <h1>VNPay Mock</h1>
  <p>Đơn hàng: <strong>${escapeHtml(params.vnp_TxnRef)}</strong></p>
  <p>Số tiền: <strong>${escapeHtml((Number(params.vnp_Amount) / 100).toLocaleString('vi-VN'))} VND</strong></p>
  <p><a href="${escapeHtml(successUrl)}">Thanh toán thành công</a></p>
  <p><a href="${escapeHtml(cancelUrl)}">Hủy thanh toán</a></p>
</body></html>`);
  });

  // VNPay thì sẽ lấy thông tin payment từ client mà xử lý thanh toán, không cần trả về URL thanh toán như Momo
  router.post('/merchant_webapi/api/transaction', async (req, res) => {
    const body = req.body as VnpayQueryBody;

    if (body.vnp_SecureHash !== expectedSignature(body)) {
      res.json({ vnp_ResponseCode: '97', vnp_Message: 'Invalid Checksum' });
      return;
    }

    const { fail } = await applyFault(control.get('vnpay'));
    if (fail) {
      res.status(502).json({ vnp_ResponseCode: '99', vnp_Message: 'Upstream VNPay error' });
      return;
    }

    res.json({
      vnp_ResponseId: body.vnp_RequestId,
      vnp_Command: 'querydr',
      vnp_ResponseCode: '00',
      vnp_Message: 'Success',
      vnp_TmnCode: body.vnp_TmnCode,
      vnp_TxnRef: body.vnp_TxnRef,
      vnp_TransactionStatus: '00',
    });
  });

  return router;
}
