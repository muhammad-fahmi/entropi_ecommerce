# Financial Rules & Ledger Design

## Double-Entry Bookkeeping

The system implements strict double-entry bookkeeping. Every financial operation records **equal and opposite** debit and credit entries, ensuring the fundamental accounting equation always holds:

> **Total Debits = Total Credits** (for every order, at all times)

## Account Chart

| Account | Type | Purpose |
|---------|------|---------|
| `order_balance` | Asset | Tracks the outstanding order amount |
| `payment` | Liability | Tracks funds received from customer |
| `fees` | Expense | Tracks platform processing fees (3%) |

## Ledger Entry Flow

### Phase 1: Order Created

When a new order is created, the system records the order amount as a receivable:

| Account | Debit | Credit |
|---------|-------|--------|
| `order_balance` | $100.00 | — |
| `payment` | — | $100.00 |

> Meaning: "We expect $100.00 from the customer."

### Phase 2: Payment Confirmed

When payment is received, the system reverses the receivable and records the cash inflow:

| Account | Debit | Credit |
|---------|-------|--------|
| `payment` | $100.00 | — |
| `order_balance` | — | $100.00 |

> Meaning: "Customer has paid $100.00, clearing the balance."

### Phase 3: Fee Calculation

A 3% processing fee is deducted from the payment:

| Account | Debit | Credit |
|---------|-------|--------|
| `fees` | $3.00 | — |
| `payment` | — | $3.00 |

> Meaning: "$3.00 is allocated to platform fees."

## Complete Ledger Example

For a $100.00 order that is created and paid:

| # | Event | Account | Debit | Credit |
|---|-------|---------|-------|--------|
| 1 | OrderCreated | `order_balance` | $100.00 | — |
| 2 | OrderCreated | `payment` | — | $100.00 |
| 3 | PaymentConfirmed | `payment` | $100.00 | — |
| 4 | PaymentConfirmed | `order_balance` | — | $100.00 |
| 5 | FeeCalculated | `fees` | $3.00 | — |
| 6 | FeeCalculated | `payment` | — | $3.00 |
| | **Totals** | | **$203.00** | **$203.00** |

✅ **Balanced** — Total Debits ($203.00) = Total Credits ($203.00)

## Decimal Precision

### Problem

IEEE 754 floating-point arithmetic causes rounding errors in financial calculations:

```javascript
0.1 + 0.2 === 0.3  // false (0.30000000000000004)
1.00 * 0.03         // 0.030000000000000002
```

### Solution

The system uses two layers of decimal precision:

**1. Application layer** — `decimal.js` library:

```typescript
const feeAmt = paymentAmt
  .mul(0.03)
  .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
// 1.00 * 0.03 = 0.0300 (exact)
```

**2. Database layer** — PostgreSQL `DECIMAL(18,4)`:

```prisma
model Ledger {
  debit   Decimal? @db.Decimal(18, 4)
  credit  Decimal? @db.Decimal(18, 4)
}

model Order {
  amount           Decimal @db.Decimal(18, 4)
  payment_received Decimal @default(0) @db.Decimal(18, 4)
}
```

| Property | Value |
|----------|-------|
| Max digits | 18 |
| Decimal places | 4 |
| Max value | 99,999,999,999,999.9999 |
| Min precision | $0.0001 |
| Rounding | HALF_UP (banker's rounding) |

### Fee Calculation Examples

| Order Amount | Fee (3%) | Stored As |
|-------------|----------|----------|
| $1.00 | $0.03 | 0.0300 |
| $0.01 | $0.0003 | 0.0003 |
| $999.99 | $30.00 | 29.9997 |
| $100.00 | $3.00 | 3.0000 |

## Event Sourcing

All state changes are captured as immutable events in the `EventLog` table:

| Event Type | Payload | Trigger |
|-----------|---------|--------|
| `OrderCreated` | `{ amount }` | `POST /api/orders` |
| `PaymentConfirmed` | `{ amount, stripeId }` | `POST /api/orders/:id/pay` |

### Event → Projection Consistency

The `Order` table is a **projection** (read model) derived from events. The system maintains consistency by:

1. Writing events and projections in the **same database transaction**
2. Using the `version` field to link events to their aggregate state
3. Enforcing `@@unique([aggregateId, version])` to prevent duplicate versions

```prisma
model EventLog {
  @@unique([aggregateId, version])  // No two events can have the same version
}
```

At any point in time: `Order.version == count(EventLog where aggregateId == orderId)`

## Audit Trail

The Ledger page (`/ledger`) provides a full audit trail:

- All ledger entries grouped by order and timestamp
- Debit and credit columns aligned for verification
- Per-transaction balance check ("Balanced" chip)
- CSV export functionality for external auditing

## Invariants

The following invariants are enforced and tested:

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Total Debits = Total Credits | Double-entry ledger entries |
| 2 | No duplicate events | `idempotencyKey @unique` |
| 3 | No invalid state transitions | State machine validation |
| 4 | No lost updates | Optimistic concurrency (version) |
| 5 | Decimal precision preserved | `decimal.js` + `DECIMAL(18,4)` |
| 6 | Event-projection consistency | Same-transaction writes |
