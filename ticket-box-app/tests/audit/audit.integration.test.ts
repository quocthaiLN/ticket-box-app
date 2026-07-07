import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketbox/database';
import { auditService } from '../../apps/api-server/src/modules/audit/audit.service.js';

const TEST_ACTION = 'TEST_AUDIT_SANITIZE';
const OTHER_ACTION = 'TEST_AUDIT_OTHER';
const ACTOR_ID = '00000000-0000-0000-0000-000000000004';

describe('admin audit service list/filter/sanitize', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany({
      where: { action: { in: [TEST_ACTION, OTHER_ACTION] } },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { action: { in: [TEST_ACTION, OTHER_ACTION] } },
    });
    await prisma.$disconnect();
  });

  it('records sanitized metadata and filters by action, actor, entity and time range', async () => {
    const entityId = crypto.randomUUID();
    const from = new Date(Date.now() - 60_000).toISOString();

    await auditService.record({
      actor_user_id: ACTOR_ID,
      action: TEST_ACTION,
      entity_type: 'test_entity',
      entity_id: entityId,
      metadata: {
        safe: 'visible',
        password: 'Password@123',
        nested: {
          access_token: 'secret-token',
          keep: 'ok',
        },
        list: [{ api_key: 'hidden' }, { name: 'public' }],
      },
      ip_address: '127.0.0.1',
      user_agent: 'vitest',
    });

    await auditService.record({
      actor_user_id: ACTOR_ID,
      action: OTHER_ACTION,
      entity_type: 'test_entity',
      entity_id: crypto.randomUUID(),
      metadata: { safe: 'other' },
    });

    const to = new Date(Date.now() + 60_000).toISOString();
    const page = await auditService.list({
      actor_user_id: ACTOR_ID,
      action: TEST_ACTION,
      entity_type: 'test_entity',
      entity_id: entityId,
      from,
      to,
      limit: 10,
    });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();

    const [item] = page.items;
    expect(item.action).toBe(TEST_ACTION);
    expect(item.actor_user_id).toBe(ACTOR_ID);
    expect(item.entity_type).toBe('test_entity');
    expect(item.entity_id).toBe(entityId);
    expect(item.metadata?.safe).toBe('visible');
    expect(item.metadata?.password).toBe('[REDACTED]');
    expect((item.metadata?.nested as Record<string, unknown>).access_token).toBe('[REDACTED]');
    expect((item.metadata?.nested as Record<string, unknown>).keep).toBe('ok');
    expect(((item.metadata?.list as Array<Record<string, unknown>>)[0]).api_key).toBe('[REDACTED]');
  });

  it('returns a cursor when more audit logs exist than the requested limit', async () => {
    for (let i = 0; i < 3; i++) {
      await auditService.record({
        actor_user_id: ACTOR_ID,
        action: TEST_ACTION,
        entity_type: 'pagination_test',
        entity_id: `page-${i}`,
        metadata: { index: i },
      });
    }

    const first = await auditService.list({
      action: TEST_ACTION,
      entity_type: 'pagination_test',
      limit: 2,
    });

    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await auditService.list({
      action: TEST_ACTION,
      entity_type: 'pagination_test',
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });

    expect(second.items).toHaveLength(1);
  });
});
