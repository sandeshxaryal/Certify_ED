# Setup Guide

This guide walks through setting up CertifyED for local development, including the blockchain, database, backend API, and frontend.

## 1. Prerequisites

Install the following before starting:

- **Node.js** `>=20.0.0 <21.0.0` (check with `node -v`)
- **npm** (bundled with Node) — the frontend also has a `bun.lockb`, so Bun works too if you prefer it
- **Docker** and **Docker Compose** (for Ganache + MongoDB)
- **Git**

Accounts/keys you'll want ready:
- A **Pinata** account (for IPFS pinning of certificate files) — get an API key and secret from pinata.cloud
- **SMTP credentials** (e.g. a Gmail app password) if you want email notifications to work
- For deploying to a public network: an **Infura** project ID or **Alchemy** API key, and a wallet **mnemonic** with test/real funds

## 2. Clone and install

```bash
git clone <repository-url>
cd Certify_ED-main

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## 3. Start local infrastructure (Ganache + MongoDB)

From the `backend` directory:

```bash
docker compose up -d ganache mongodb
```

This starts:
- **Ganache** (local Ethereum chain) on `localhost:8545`, with deterministic wallets and chain ID `5777`
- **MongoDB** on `localhost:27017`, with a `certifyed` database

Data for both is persisted in Docker volumes (`blockchain_data`, `mongodb_data`), so state survives container restarts.

To also compile and migrate the contract inside Docker (instead of doing it locally, see step 5), you can run the optional `truffle` service:

```bash
docker compose --profile deploy up -d truffle
```

## 4. Configure environment variables

Create a `.env` file inside `backend/` (this file is not checked into the repo). The backend and Truffle both read from it via `dotenv`.

```ini
# --- Server ---
NODE_ENV=development
PORT=3000
APP_PROTOCOL=http
APP_HOST=localhost:3000
APP_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# --- Database ---
MONGODB_URI=mongodb://localhost:27017/certifyed

# --- Auth ---
JWT_SECRET=replace-with-a-long-random-string
REFRESH_SECRET=replace-with-a-long-random-string
SIGNATURE_SECRET=replace-with-a-long-random-string
KEY_ENCRYPTION_KEY=replace-with-a-base64-32-byte-key

# --- Admin ---
ADMIN_EMAILS=admin@example.com

# --- Blockchain (local) ---
GANACHE_HOST=127.0.0.1
PROVIDER_URL=http://127.0.0.1:8545
NETWORK=development
BLOCKCHAIN_NETWORK=development
CONTRACT_ADDRESS=            # filled in automatically after migration, or set manually
PRIVATE_KEY=                 # private key of the deploying/issuing wallet (local Ganache account)

# --- Blockchain (public testnets/mainnet, optional) ---
MNEMONIC=
INFURA_PROJECT_ID=
INFURA_KEY=
ALCHEMY_API_KEY=

# --- IPFS (Pinata) ---
PINATA_API_KEY=
PINATA_API_SECRET=

# --- Email ---
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="CertifyED <your-email@gmail.com>"
```

Notes:
- `KEY_ENCRYPTION_KEY` is used to encrypt institute private keys at rest. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `PRIVATE_KEY` should correspond to one of the funded accounts Ganache prints out on startup (`docker compose logs ganache`) for local development.
- Leave `MNEMONIC`, `INFURA_PROJECT_ID`, and `ALCHEMY_API_KEY` blank unless you're deploying to Sepolia, Mumbai, Polygon, or Mainnet.

Create a `.env` file inside `frontend/` for the frontend to know where the API lives:

```ini
VITE_API_URL=http://localhost:3000
```

## 5. Compile and deploy the smart contract

From `backend/`:

```bash
npm run compile          # compiles contracts/Certification.sol
npm run migrate:local    # deploys to local Ganache (development network)
```

After migration, copy the deployed contract address from the Truffle output into `CONTRACT_ADDRESS` in `backend/.env`.

To deploy to a public network instead:

```bash
npm run migrate:sepolia   # or migrate:mumbai / migrate:polygon
```

These require `MNEMONIC` plus `INFURA_PROJECT_ID` (Sepolia) or `ALCHEMY_API_KEY` (Mumbai/Polygon) to be set in `.env`.

To wipe and redeploy locally:

```bash
npm run migrate:reset
```

## 6. Run the backend

```bash
cd backend
npm run dev     # nodemon, auto-reloads on file changes
# or
npm start       # plain node
```

On startup the server:
1. Connects to MongoDB
2. Initializes the blockchain connection
3. Starts a certificate confirmation listener and scheduled jobs (pending certificate checks, confirmation emails)
4. Starts the HTTP + Socket.IO server (default port `3000`)

Watch the console output — it logs the Mongo host, blockchain provider URL, and confirms when the server is ready.

## 7. Run the frontend

```bash
cd frontend
npm run dev
```

The Vite dev server runs at `http://localhost:5173` by default and talks to the backend via `VITE_API_URL`.

## 8. Verify everything works

- Visit `http://localhost:5173` — you should see the CertifyED landing page.
- Check `http://localhost:3000/api/health` — should return a healthy status.
- Register/log in as an institute, issue a test certificate, and confirm it appears with a pending → confirmed status update (via the Socket.IO-driven UI).
- Use the verification page with the certificate you issued to confirm the on-chain hash matches.

## 9. Running contract tests

```bash
cd backend
npm test
```

This runs the Truffle test suite (Mocha) against the contracts in `contracts/`.

## 10. Optional: one-time key migration script

If you have existing users with plaintext `privateKey` values (e.g. from an older version of the schema), encrypt them with:

```bash
cd backend
KEY_ENCRYPTION_KEY=<your-key> node scripts/encryptExistingKeys.js
```

This is safe to re-run — already-encrypted rows are skipped.

## Troubleshooting

| Issue | Likely cause |
|---|---|
| Backend fails at "Initializing blockchain..." | Ganache isn't running, or `PROVIDER_URL`/`GANACHE_HOST` is wrong |
| `MongoServerError` / connection refused | MongoDB container isn't running, or `MONGODB_URI` is wrong |
| Contract calls fail with "contract not deployed" | `CONTRACT_ADDRESS` wasn't updated after migration, or you migrated to the wrong network |
| Certificate uploads fail | Missing/invalid `PINATA_API_KEY` / `PINATA_API_SECRET` |
| No confirmation emails | Missing/invalid `EMAIL_*` SMTP settings, or provider requires an app-specific password |
| CORS errors in the browser | `FRONTEND_URL` in backend `.env` doesn't match the frontend's actual origin |
