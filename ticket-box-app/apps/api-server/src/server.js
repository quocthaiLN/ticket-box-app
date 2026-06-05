import { disconnect as closeRedis } from '@ticket-box/redis';
import app from './app.js';

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

/**
 * Graceful shutdown: đóng Redis connection trước khi exit
 * 
 * Lý do:
 *   - Redis connection nên được đóng cleanly (QUIT command)
 *   - Tránh connection leak, pending requests
 */
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
        await closeRedis();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(async () => {
        await closeRedis();
        process.exit(0);
    });
});