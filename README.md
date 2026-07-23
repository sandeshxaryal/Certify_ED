[README.md](https://github.com/user-attachments/files/30298798/README.md)
# CertifyED

CertifyED is a blockchain-based certificate verification platform. Institutes issue certificates that are hashed and anchored on-chain, and anyone can verify a certificate's authenticity without relying on a central authority.

## How it works

1. An institute uploads or generates a certificate for a recipient.
2. The certificate is hashed and, along with its metadata, pinned to IPFS (via Pinata).
3. The hash is written to a smart contract (`Certification.sol`) deployed on an Ethereum-compatible chain.
4. A recipient or third party can later verify a certificate by re-hashing the document and comparing it against the on-chain record — confirming it hasn't been altered or forged.
5. Real-time status updates (e.g. certificate confirmation) are pushed to the frontend over Socket.IO.

## Tech stack

**Frontend**
- React 19 + Vite
- Tailwind CSS
- React Router
- Konva / React-Konva (certificate template editor/canvas)
- react-pdf, xlsx, crypto-js
- Socket.IO client

**Backend**
- Node.js (>=20) + Express
- MongoDB with Mongoose
- ethers.js / web3.js for blockchain interaction
- Socket.IO for real-time updates
- Pinata SDK for IPFS pinning
- Truffle for smart contract compilation/migration
- Nodemailer for email notifications
- JWT-based authentication, bcrypt for password hashing

**Blockchain**
- Solidity smart contract (`Certification.sol`)
- Truffle migrations
- Ganache for local development
- Deployable to Sepolia, Polygon Mumbai, Polygon Mainnet, or Ethereum Mainnet

**Infrastructure**
- Docker Compose (Ganache + MongoDB + Truffle deployment container)

## Project structure

```
Certify_ED-main/
├── backend/
│   ├── contracts/            # Solidity smart contracts
│   ├── migrations/           # Truffle migration scripts
│   ├── scripts/               # One-off maintenance scripts (e.g. key migration)
│   ├── src/
│   │   ├── app.js             # Express app + route mounting (active entry point)
│   │   ├── index.js           # HTTP + Socket.IO server bootstrap, blockchain init, scheduled jobs
│   │   ├── config.js          # Static app config (DB name, Pinata URLs)
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/            # Express route definitions
│   │   ├── models/            # Mongoose schemas
│   │   ├── middlewares/       # Auth, file upload, admin guards
│   │   ├── helpers/ & utils/  # Blockchain, email, PDF, crypto helper functions
│   │   └── db/                # MongoDB connection
│   ├── docker-compose.yaml
│   ├── Dockerfile.ganache
│   ├── Dockerfile.truffle
│   └── truffle-config.cjs
└── frontend/
    ├── src/
    │   ├── pages/              # Route-level views (auth, certificates, verify, upload, etc.)
    │   ├── components/         # Reusable UI components
    │   ├── contexts/           # React context providers (auth, verification)
    │   └── assets/
    └── vite.config.js
```

> Note: the backend contains a second, parallel set of modules (`server.js`, `main.js`, `endpoints/`, `handlers/`, `guards/`) that mirror `app.js`/`index.js`/`routes/`/`controllers/`/`middlewares/`. The active entry point used by the `start`/`dev` npm scripts is `src/index.js` → `src/app.js`.

## Prerequisites

- Node.js >= 20 and < 21
- Docker & Docker Compose (for Ganache and MongoDB locally)
- A MongoDB instance (local via Docker, or a hosted URI)
- A Pinata account (IPFS pinning) if you want certificate storage to work
- An email account/SMTP credentials for notifications (optional but required for email features)
- For public testnets/mainnet: an Infura or Alchemy project, and a funded wallet mnemonic

## Quick start

See [SETUP.md](./SETUP.md) for full step-by-step installation and configuration instructions.

```bash
# 1. Start local blockchain + database
cd backend
docker compose up -d ganache mongodb

# 2. Install backend deps, compile & migrate contracts
npm install
npm run compile
npm run migrate:local

# 3. Start backend
npm run dev

# 4. In a separate terminal, start frontend
cd ../frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3000` by default.

## Available scripts

**Backend** (`backend/package.json`)
| Script | Description |
|---|---|
| `npm start` | Run the server (production mode) |
| `npm run dev` | Run the server with nodemon (auto-reload) |
| `npm run setup` | Run project setup script |
| `npm run compile` | Compile smart contracts with Truffle |
| `npm run migrate:local` | Deploy contracts to local Ganache network |
| `npm run migrate:sepolia` | Deploy contracts to Sepolia testnet |
| `npm run migrate:mumbai` | Deploy contracts to Polygon Mumbai testnet |
| `npm run migrate:polygon` | Deploy contracts to Polygon mainnet |
| `npm run migrate:reset` | Re-deploy contracts locally, ignoring prior deployments |
| `npm test` | Run Truffle smart contract tests |
| `npm run console:local` / `:sepolia` / `:mumbai` | Open a Truffle console against the given network |

**Frontend** (`frontend/package.json`)
| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Deployment targets

The smart contract can be migrated to:
- **development** — local Ganache (Docker or standalone)
- **sepolia** — Ethereum Sepolia testnet
- **mumbai** — Polygon Mumbai testnet
- **polygon** — Polygon mainnet
- **mainnet** — Ethereum mainnet

Network details (gas, confirmations, RPC provider) are configured in `backend/truffle-config.cjs`.

## License

ISC
