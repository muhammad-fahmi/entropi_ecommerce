# Architecture Overview

## System Diagram

```mermaid
graph TB
    subgraph Client ["Frontend (Next.js 14)"]
        UI["React UI (MUI v9)"]
        Pages["Pages"]
        UI --> Pages
        Pages --> ProductList["/products"]
        Pages --> ProductDetail["/products/:id"]
        Pages --> Checkout["/checkout"]
        Pages --> Ledger["/ledger"]
    end

    subgraph Backend ["Backend (Fastify)"]
        API["REST API :3001"]
        OrderSvc["Order Service"]
        PaymentSvc["Payment Service"]
        LedgerSvc["Ledger Service"]
        API --> OrderSvc
        API --> PaymentSvc
        API --> LedgerSvc
    end

    subgraph External ["External Services"]
        Stripe["Stripe Mock"]
    end

    subgraph Database ["PostgreSQL 15"]
        EventLog[("EventLog")]
        OrderTable[("Order")]
        LedgerTable[("Ledger")]
    end

    UI -->|fetch| API
    PaymentSvc -->|charge| Stripe
    OrderSvc -->|$transaction| EventLog
    OrderSvc -->|$transaction| OrderTable
    OrderSvc -->|$transaction| LedgerTable
    PaymentSvc -->|$transaction| EventLog
    PaymentSvc -->|$transaction| OrderTable
    PaymentSvc -->|$transaction| LedgerTable

    style Client fill:#1a1a2e,stroke:#e94560,color:#fff
    style Backend fill:#16213e,stroke:#0f3460,color:#fff
    style Database fill:#0f3460,stroke:#533483,color:#fff
    style External fill:#533483,stroke:#e94560,color:#fff
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|--------|
| Frontend | Next.js 14 + React 18 | SSR/CSR pages |
| UI Library | MUI v9 + Emotion | Component system |
| Backend | Fastify 5 | REST API server |
| ORM | Prisma 5 | Type-safe DB access |
| Database | PostgreSQL 15 | Persistent storage |
| Precision | decimal.js | Financial math |
| Payments | Stripe Mock | Simulated charges |
| Container | Docker Compose | Local orchestration |
| Tests | Jest 30 + ts-jest | Automated testing |

## Project Structure

```
entropi_ecommerce/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with MUI theme
│   │   ├── page.tsx            # Home / product listing
│   │   ├── products/[id]/      # Product detail page
│   │   ├── checkout/           # Checkout flow
│   │   └── ledger/             # Ledger audit trail
│   ├── components/             # Shared React components
│   │   └── Navigation.tsx      # Bottom nav bar
│   ├── context/                # React context providers
│   ├── data/                   # Static product data
│   ├── server/
│   │   └── index.ts            # Fastify backend (port 3001)
│   └── theme.ts                # MUI theme config
├── prisma/
│   └── schema.prisma           # Database schema
├── tests/
│   └── backend.test.ts         # 10 test cases
├── docker-compose.yml          # PostgreSQL + Backend
└── package.json
```

## Data Flow

### Order Creation

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API Server
    participant DB as PostgreSQL

    C->>A: POST /api/orders
    A->>DB: BEGIN TRANSACTION
    A->>DB: Check idempotency (EventLog)
    alt Already exists
        DB-->>A: Return existing event
    else New order
        A->>DB: INSERT Order (version=1)
        A->>DB: INSERT EventLog (OrderCreated)
        A->>DB: INSERT Ledger (DR order_balance, CR payment)
    end
    A->>DB: COMMIT
    A-->>C: 200 OK { event }
```

### Payment Processing

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API Server
    participant S as Stripe Mock
    participant DB as PostgreSQL

    C->>A: POST /api/orders/:id/pay
    A->>DB: TX1: Validate state + idempotency
    alt Already paid
        A-->>C: 500 Invalid transition
    else Pending
        A->>S: mockStripeCharge(amount)
        S-->>A: { chargeId, status }
        A->>DB: TX2: BEGIN
        A->>DB: UPDATE Order (optimistic version check)
        A->>DB: INSERT EventLog (PaymentConfirmed)
        A->>DB: INSERT Ledger (DR payment, CR order_balance)
        A->>DB: INSERT Ledger (DR fees, CR payment) [3% fee]
        A->>DB: COMMIT
        A-->>C: 200 OK { order, event }
    end
```

## API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/api/orders` | Create a new order |
| `POST` | `/api/orders/:id/pay` | Process payment for an order |
| `GET` | `/api/ledger` | Retrieve all ledger entries |

## Database Schema

```mermaid
erDiagram
    Order ||--o{ Ledger : "has"
    Order {
        string id PK
        string customerId
        decimal amount
        decimal payment_received
        string status
        int version
        datetime createdAt
        datetime updatedAt
    }
    Ledger {
        string id PK
        string orderId FK
        string account
        decimal debit
        decimal credit
        datetime timestamp
    }
    EventLog {
        string id PK
        string aggregateId
        string eventType
        json payload
        int version
        datetime timestamp
        string idempotencyKey UK
    }
```
