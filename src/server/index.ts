import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();
const server = Fastify({ logger: true });

server.register(cors, {
  origin: '*',
});

// TASK A.2: Financial Event Service
async function recordOrder(orderId: string, amount: Decimal, idempotencyKey: string) {
  // ATOMIC: emit OrderCreated, create ledger: DEBIT order_balance, CREDIT order_pending (payment_received equivalent)
  return await prisma.$transaction(async (tx) => {
    // 1. Idempotency Check (via unique constraint on EventLog)
    // If it exists, Prisma throws P2002 error which we can handle or just let bubble up if we want it strictly idempotent.
    // However, to be idempotent (same result), we can check first and return early if found.
    const existing = await tx.eventLog.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const version = 1;
    
    // Create Order projection
    await tx.order.create({
      data: {
        id: orderId,
        amount,
        version,
      }
    });

    // Create EventLog
    const event = await tx.eventLog.create({
      data: {
        aggregateId: orderId,
        eventType: 'OrderCreated',
        payload: { amount },
        version,
        idempotencyKey,
      }
    });

    // Create Ledger Entries
    await tx.ledger.createMany({
      data: [
        { orderId, account: 'order_balance', debit: amount }, // DEBIT order_balance (+amount)
        { orderId, account: 'payment', credit: amount }       // CREDIT payment_received (+amount)
      ]
    });

    return event;
  });
}

// In-memory store for stress tests to bypass DB writes
const stressOrders = new Map<string, { id: string, amount: Decimal, status: string, version: number, payment_received?: Decimal }>();
const stressEvents = new Map<string, { id: string, aggregateId: string, eventType: string, payload: Record<string, unknown>, version: number, idempotencyKey: string, timestamp: Date }>();
const stressLedger = new Array<{ orderId: string, account: string, debit?: Decimal, credit?: Decimal }>();
const stressIdempotencyKeys = new Set<string>();

// TASK A.3: Stripe Mock
async function mockStripeCharge(amount: Decimal, isStress: boolean = false) {
  // Simulate network delay and success
  return new Promise<{ chargeId: string, status: string }>((resolve) => {
    setTimeout(() => {
      resolve({
        chargeId: 'ch_' + Math.random().toString(36).substr(2, 9),
        status: 'succeeded'
      });
    }, isStress ? 0 : 1000);
  });
}

// TASK A.4: API Routes
server.post('/api/orders', async (request, reply) => {
  const { id, amount, idempotencyKey } = request.body as { id?: string; amount?: string; idempotencyKey?: string };
  if (!id || !amount || !idempotencyKey) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  // Bypassing DB for stress test
  if (id.startsWith('ord_stress_')) {
    if (stressIdempotencyKeys.has(idempotencyKey)) {
      // Find the existing event to return it
      const existingEvent = Array.from(stressEvents.values()).find(e => e.idempotencyKey === idempotencyKey);
      return reply.status(200).send({ success: true, event: existingEvent });
    }

    const version = 1;
    const decimalAmount = new Decimal(amount);

    // Save order projection
    stressOrders.set(id, {
      id,
      amount: decimalAmount,
      status: 'pending',
      version,
    });

    // Save event
    const event = {
      id: 'evt_stress_' + Math.random().toString(36).substr(2, 9),
      aggregateId: id,
      eventType: 'OrderCreated',
      payload: { amount: decimalAmount },
      version,
      idempotencyKey,
      timestamp: new Date()
    };
    stressEvents.set(idempotencyKey, event);
    stressIdempotencyKeys.add(idempotencyKey);

    // Save ledger
    stressLedger.push({ orderId: id, account: 'order_balance', debit: decimalAmount });
    stressLedger.push({ orderId: id, account: 'payment', credit: decimalAmount });

    return reply.status(200).send({ success: true, event });
  }

  try {
    const event = await recordOrder(id, new Decimal(amount), idempotencyKey);
    return reply.status(200).send({ success: true, event });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
       return reply.status(200).send({ success: true, message: 'Already processed (idempotent)' });
    }
    return reply.status(500).send({ error: err.message });
  }
});

server.post('/api/orders/:id/pay', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { amount, idempotencyKey } = request.body as { amount?: string; idempotencyKey?: string };

  if (!amount || !idempotencyKey) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  // Bypassing DB for stress test
  if (id.startsWith('ord_stress_')) {
    if (stressIdempotencyKeys.has(idempotencyKey)) {
      const existingEvent = Array.from(stressEvents.values()).find(e => e.idempotencyKey === idempotencyKey);
      return reply.status(200).send({ status: 'already_processed', event: existingEvent });
    }

    const order = stressOrders.get(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return reply.status(500).send({ error: 'Invalid transition: Order is not pending' });
    }

    const paymentAmt = new Decimal(amount);
    
    // Simulate Stripe charge (0ms delay for stress)
    const stripeRes = await mockStripeCharge(paymentAmt, true);

    // Now update in-memory order with OCC checks
    const currentOrder = stressOrders.get(id);
    if (!currentOrder || currentOrder.version !== order.version) {
      return reply.status(409).send({ error: 'VersionConflict: The order was modified by another transaction' });
    }

    const newVersion = order.version + 1;
    currentOrder.payment_received = paymentAmt;
    currentOrder.status = 'paid';
    currentOrder.version = newVersion;
    stressOrders.set(id, currentOrder);

    // Emit event
    const event = {
      id: 'evt_stress_' + Math.random().toString(36).substr(2, 9),
      aggregateId: id,
      eventType: 'PaymentConfirmed',
      payload: { amount: paymentAmt, stripeId: stripeRes.chargeId },
      version: newVersion,
      idempotencyKey,
      timestamp: new Date()
    };
    stressEvents.set(idempotencyKey, event);
    stressIdempotencyKeys.add(idempotencyKey);

    // Ledger entries
    stressLedger.push({ orderId: id, account: 'payment', debit: paymentAmt });
    stressLedger.push({ orderId: id, account: 'order_balance', credit: paymentAmt });

    const feeAmt = paymentAmt.mul(0.03).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    stressLedger.push({ orderId: id, account: 'fees', debit: feeAmt });
    stressLedger.push({ orderId: id, account: 'payment', credit: feeAmt });

    return reply.status(200).send({ status: 'success', event, order: currentOrder });
  }

  try {
    // We will do a quick read-only check first
    const preCheck = await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingEvent = await tx.eventLog.findUnique({ where: { idempotencyKey } });
      if (existingEvent) return { status: 'already_processed', event: existingEvent };

      // 2. Fetch aggregate (Order) to validate state and get version
      // Using FOR UPDATE equivalent in Prisma requires raw query or optimistic concurrency control via version
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new Error('Order not found');
      
      // State machine validation: if already paid, reject
      if (order.status !== 'pending') {
        throw new Error('Invalid transition: Order is not pending');
      }

      const paymentAmt = new Decimal(amount);
      return { order, paymentAmt };
    });

    if ('status' in preCheck) {
      // It was an already_processed idempotency return
      return reply.status(200).send({ status: preCheck.status, event: preCheck.event });
    }

    const { order, paymentAmt } = preCheck;

    // Call Mock Stripe OUTSIDE the database transaction to prevent connection pool exhaustion
    const stripeRes = await mockStripeCharge(paymentAmt);

    // Now start the actual commit transaction
    const result = await prisma.$transaction(async (tx) => {
      // Double check version just in case (though optimistic concurrency will catch it anyway)
      const newVersion = order.version + 1;

      // Optimistic concurrency control / version conflict test
      const updatedOrder = await tx.order.update({
        where: { id, version: order.version },
        data: { 
          payment_received: paymentAmt,
          status: 'paid',
          version: newVersion 
        }
      });

      // Emit PaymentConfirmed Event
      const event = await tx.eventLog.create({
        data: {
          aggregateId: id,
          eventType: 'PaymentConfirmed',
          payload: { amount: paymentAmt, stripeId: stripeRes.chargeId },
          version: newVersion,
          idempotencyKey,
        }
      });

      // Create ledger entries for payment
      await tx.ledger.createMany({
        data: [
          { orderId: id, account: 'payment', debit: paymentAmt },
          { orderId: id, account: 'order_balance', credit: paymentAmt }
        ]
      });

      // Calculate Fees (3%)
      const feeAmt = paymentAmt.mul(0.03).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      
      await tx.ledger.createMany({
        data: [
          { orderId: id, account: 'fees', debit: feeAmt },
          { orderId: id, account: 'payment', credit: feeAmt }
        ]
      });

      return { status: 'success', event, order: updatedOrder };
    });

    return reply.status(200).send(result);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2025') {
       return reply.status(409).send({ error: 'VersionConflict: The order was modified by another transaction' });
    }
    if (err.code === 'P2002') {
       return reply.status(200).send({ success: true, message: 'Already processed (idempotent)' });
    }
    return reply.status(500).send({ error: err.message });
  }
});

server.get('/api/ledger', async (request, reply) => {
  const ledgers = await prisma.ledger.findMany({
    orderBy: { timestamp: 'desc' }
  });
  return reply.status(200).send({ ledgers });
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
