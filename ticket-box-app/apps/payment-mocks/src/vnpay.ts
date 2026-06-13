import { createHmac } from 'node:crypto';
import { Router } from 'express';
import { paymentConfig } from '@ticketbox/config/payment.js';
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
  return createHmac('sha512', paymentConfig.vnpay.hashSecret).update(hashData, 'utf8').digest('hex');
}

/** Mock of VNPay's QueryDR POST /merchant_webapi/api/transaction — validates real HMAC-SHA512. */
export function vnpayRouter(control: ControlStore): Router {
  const router = Router();

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
