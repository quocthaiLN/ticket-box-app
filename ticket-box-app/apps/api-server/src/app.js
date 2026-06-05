import express from 'express';
import { getInstance as getRedisClient } from '@ticket-box/redis';
import ticketingRouter from './modules/ticketing/ticketing.routes.js';
import inventoryRouter from './modules/inventory/inventory.router.js';

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Set up Request ID middleware for tracing and logging
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || `req_${Math.random().toString(36).substring(2, 11)}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

/**
 * Middleware: Initialize Redis connection when app starts
 */
let redisReady = false;
app.use(async (req, res, next) => {
    if (!redisReady) {
        try {
            await getRedisClient();
            redisReady = true;
            console.log('✓ Redis ready, app can accept requests');
        } catch (error) {
            console.error('✗ Redis initialization failed:', error.message);
            return res.status(503).json({ error: 'Service unavailable: Redis not ready' });
        }
    }
    next();
});

// Register ticketing module routes
app.use('/v1/tickets', ticketingRouter);

// Register inventory module routes
app.use('/v1', inventoryRouter);

// Global RFC 7807 Error Handling Middleware
app.use((err, req, res, next) => {
    // If headers are already sent, delegate to default express error handler
    if (res.headersSent) {
        return next(err);
    }

    console.error('API Error:', err);

    const status = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const detail = err.message || 'Đã xảy ra lỗi không xác định trên hệ thống.';
    
    // Map code to appropriate title
    let title = 'Lỗi hệ thống';
    if (status === 404) {
        title = 'Tài nguyên không tồn tại';
    } else if (status === 409) {
        title = 'Xung đột dữ liệu hoặc trạng thái nghiệp vụ';
    } else if (status === 422) {
        title = 'Dữ liệu không hợp lệ với nghiệp vụ';
    } else if (status === 400) {
        title = 'Yêu cầu không hợp lệ';
    }

    const errorType = err.type || `https://api.ticketbox.vn/errors/${code.toLowerCase().replace(/_/g, '-')}`;

    return res
        .status(status)
        .contentType('application/problem+json')
        .json({
            type: errorType,
            title: title,
            status: status,
            code: code,
            detail: detail,
            instance: req.originalUrl,
            request_id: req.requestId,
            ...(err.errors ? { errors: err.errors } : {})
        });
});

export default app;