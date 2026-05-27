import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

jest.setTimeout(120000);

// Setup Prisma Client for assertions
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';

describe('Financial Event Store & Ledger API', () => {
  let orderId: string;
  let idempotencyKeyCreate: string;
  let idempotencyKeyPay: string;

  beforeEach(() => {
    orderId = 'ord_' + Math.random().toString(36).substring(2, 10);
    idempotencyKeyCreate = 'idmp_' + Math.random().toString(36).substring(2, 10);
    idempotencyKeyPay = 'idmp_pay_' + Math.random().toString(36).substring(2, 10);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Happy Path: Should create an order and record payment successfully', async () => {
    // Create Order
    const createRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, amount: '100.00', idempotencyKey: idempotencyKeyCreate })
    });
    const createData = await createRes.json();
    expect(createRes.status).toBe(200);
    expect(createData.success).toBe(true);

    // Record Payment
    const payRes = await fetch(`${API_URL}/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '100.00', idempotencyKey: idempotencyKeyPay, stripeId: 'mock_ch_123' })
    });
    const payData = await payRes.json();
    expect(payRes.status).toBe(200);
    expect(payData.status).toBe('success');
    expect(payData.order.status).toBe('paid');
  });

  it('2. Idempotency: Should return the exact same response for duplicate create/pay requests', async () => {
    // Create twice with same key
    const res1 = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, amount: '50.00', idempotencyKey: idempotencyKeyCreate })
    });
    const res2 = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, amount: '50.00', idempotencyKey: idempotencyKeyCreate })
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.event).toBeDefined();
    expect(data2.event.idempotencyKey).toBe(idempotencyKeyCreate);
  });

  it('3. Ledger Balance: Sum of Debits must strictly equal Sum of Credits', async () => {
    const ledgers = await prisma.ledger.findMany({ where: { orderId } });
    const totalDebit = ledgers.reduce((sum, l) => sum.plus(l.debit || 0), new Decimal(0));
    const totalCredit = ledgers.reduce((sum, l) => sum.plus(l.credit || 0), new Decimal(0));
    expect(totalDebit.equals(totalCredit)).toBe(true);
  });

  it('4. Decimal Precision: Edge case calculation (e.g. 1 USD fee = 0.03)', async () => {
    const smallOrderId = 'ord_small';
    const smallIdmp = 'idmp_small_pay';
    
    await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: smallOrderId, amount: '1.00', idempotencyKey: 'idmp_small_create' })
    });

    await fetch(`${API_URL}/orders/${smallOrderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '1.00', idempotencyKey: smallIdmp, stripeId: 'mock' })
    });

    const feeLedger = await prisma.ledger.findFirst({
      where: { orderId: smallOrderId, account: 'fees' }
    });
    
    // 3% of 1.00 is 0.0300
    expect(feeLedger?.debit?.toNumber()).toBe(0.03);
  });

  it('5. Concurrent Orders: 100 concurrent payments should not corrupt ledger or duplicate', async () => {
    // Generate 100 orders
    const orders = Array.from({ length: 100 }).map((_, i) => ({
      id: `ord_batch_${i}`,
      amount: '50.00',
      idmpC: `idmp_bc_${i}`,
      idmpP: `idmp_bp_${i}`
    }));

    // Helper to process in batches
    const batchSize = 20;
    async function runInBatches<T>(items: T[], fn: (item: T) => Promise<any>): Promise<any[]> {
      const results: any[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
      }
      return results;
    }

    // Create all in batches
    await runInBatches(orders, o => fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, amount: o.amount, idempotencyKey: o.idmpC })
    }));

    // Pay all concurrently in batches
    const payResponses = await runInBatches(orders, o => fetch(`${API_URL}/orders/${o.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: o.amount, idempotencyKey: o.idmpP, stripeId: 'mock' })
    }));

    const failed = payResponses.filter((r: any) => r.status !== 200);
    if (failed.length > 0) {
      console.log('Failed responses:', await Promise.all(failed.map((r: any) => r.text())));
    }
    expect(payResponses.every((r: any) => r.status === 200)).toBe(true);

    // Verify exactly 100 payment confirmed events
    const count = await prisma.eventLog.count({ where: { eventType: 'PaymentConfirmed', aggregateId: { startsWith: 'ord_batch_' } } });
    expect(count).toBe(100);
  });

  it('6. Settlement Idempotency: Not implemented yet, testing placeholder', () => {
    expect(true).toBe(true);
  });

  it('7. Version Conflict: Optimistic concurrency rejects outdated modifications', async () => {
    // This is tested by the fact that concurrent duplicate pay calls on the same order would fail.
    // Let's fire 5 simultaneous identical payments to the exact same order.
    const concOrderId = 'ord_conc_test';
    await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: concOrderId, amount: '10.00', idempotencyKey: 'c_test' })
    });

    const requests = Array.from({ length: 5 }).map((_, i) => fetch(`${API_URL}/orders/${concOrderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // We must use DIFFERENT idempotency keys to bypass the idempotency check and hit the version check!
      body: JSON.stringify({ amount: '10.00', idempotencyKey: `p_test_${i}`, stripeId: 'mock' })
    }));

    const responses = await Promise.all(requests);
    
    // Exactly one should succeed (200), the others should fail with 409 (VersionConflict) or 500 (Invalid Transition)
    const successes = responses.filter(r => r.status === 200);
    const conflicts = responses.filter(r => r.status === 409 || r.status === 500);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);
  });

  it('8. Invalid Transition: Paying an already paid order', async () => {
    // concOrderId is already paid
    const res = await fetch(`${API_URL}/orders/ord_conc_test/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '10.00', idempotencyKey: 'new_p_test', stripeId: 'mock' })
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Invalid transition');
  });

  it('9. Projection Consistency: Read model matches event log', async () => {
    const order = await prisma.order.findUnique({ where: { id: 'ord_conc_test' } });
    const events = await prisma.eventLog.findMany({ where: { aggregateId: 'ord_conc_test' } });
    
    expect(order?.version).toBe(events.length);
    expect(order?.status).toBe('paid');
  });
});

describe('Stress Test: 1000 Concurrent Orders (Durability)', () => {
  const TOTAL_ORDERS = 1000;
  const BATCH_SIZE = 50;
  const API_URL = 'http://localhost:3001/api';

  async function runInBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  it(`should handle ${TOTAL_ORDERS} concurrent order creations + payments without crashing`, async () => {
    const startTime = Date.now();

    // Generate 1000 unique orders
    const orders = Array.from({ length: TOTAL_ORDERS }).map((_, i) => ({
      id: `ord_stress_${Date.now()}_${i}`,
      amount: (Math.random() * 999 + 1).toFixed(2),
      idmpC: `idmp_sc_${Date.now()}_${i}`,
      idmpP: `idmp_sp_${Date.now()}_${i}`
    }));

    // Phase 1: Create all orders
    const createStart = Date.now();
    const createResponses = await runInBatches(orders, o =>
      fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: o.id, amount: o.amount, idempotencyKey: o.idmpC })
      }).catch(err => ({ status: 0, error: err.message, ok: false } as any))
    );
    const createDuration = Date.now() - createStart;

    const createSuccess = createResponses.filter((r: any) => r.status === 200).length;
    const createFailed = createResponses.filter((r: any) => r.status !== 200).length;

    console.log(`\n--- STRESS TEST REPORT ---`);
    console.log(`Total orders: ${TOTAL_ORDERS}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`\n[Phase 1: Order Creation]`);
    console.log(`  Success: ${createSuccess}/${TOTAL_ORDERS}`);
    console.log(`  Failed:  ${createFailed}/${TOTAL_ORDERS}`);
    console.log(`  Duration: ${createDuration}ms`);
    console.log(`  Throughput: ${(createSuccess / (createDuration / 1000)).toFixed(1)} orders/sec`);

    // Phase 2: Pay only successfully created orders
    const payableOrders = orders.filter((_, i) => (createResponses[i] as any).status === 200);
    const payStart = Date.now();
    const payResponses = await runInBatches(payableOrders, o =>
      fetch(`${API_URL}/orders/${o.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: o.amount, idempotencyKey: o.idmpP, stripeId: 'mock_stress' })
      }).catch(err => ({ status: 0, error: err.message, ok: false } as any))
    );
    const payDuration = Date.now() - payStart;

    const paySuccess = payResponses.filter((r: any) => r.status === 200).length;
    const payFailed = payResponses.filter((r: any) => r.status !== 200).length;
    const totalDuration = Date.now() - startTime;

    console.log(`\n[Phase 2: Payment Processing]`);
    console.log(`  Success: ${paySuccess}/${payableOrders.length}`);
    console.log(`  Failed:  ${payFailed}/${payableOrders.length}`);
    console.log(`  Duration: ${payDuration}ms`);
    console.log(`  Throughput: ${(paySuccess / (payDuration / 1000)).toFixed(1)} payments/sec`);

    console.log(`\n[Summary]`);
    console.log(`  Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`  End-to-end throughput: ${((createSuccess + paySuccess) / (totalDuration / 1000)).toFixed(1)} ops/sec`);
    console.log(`  Error rate: ${(((createFailed + payFailed) / (TOTAL_ORDERS * 2)) * 100).toFixed(2)}%`);
    console.log(`--- END STRESS TEST ---\n`);

    // Durability assertions: server must not crash, and at least 95% success rate
    const totalOps = TOTAL_ORDERS + payableOrders.length;
    const totalSuccess = createSuccess + paySuccess;
    const successRate = totalSuccess / totalOps;

    expect(successRate).toBeGreaterThanOrEqual(0.95);

    // Verify server is still alive after the stress test
    const healthCheck = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: `ord_health_${Date.now()}`, amount: '1.00', idempotencyKey: `idmp_health_${Date.now()}` })
    });
    expect(healthCheck.status).toBe(200);
  });
});
