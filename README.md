# Roomie

A Codespaces-ready roommate matching demo with a FastAPI/LangGraph backend, PostgreSQL + pgvector, and a Next.js swipe interface.

## Run in GitHub Codespaces

The dev container provides Python 3.11, Node.js 20, and Docker-in-Docker. After opening the repository in a Codespace:

```bash
cp backend/.env.example backend/.env
docker compose up -d --wait db
```

In a terminal, install backend dependencies and seed the database:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m backend.main --seed
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Open the forwarded port 3000. The frontend detects the matching forwarded port 8000 in Codespaces; outside Codespaces it calls `http://localhost:8000`. Set `NEXT_PUBLIC_API_URL` if your forwarded host differs.

For Vercel deployment, set the frontend environment variable `NEXT_PUBLIC_API_URL` to the public URL of your FastAPI backend (for example `https://your-backend.up.railway.app` or another deployed API origin). The app will use the same default `http://localhost:8000` only in local development.

## Native mobile app

The Flutter app in [`mobile/`](./mobile/README.md) provides a native Android
and iOS client alongside the website. Start and seed the backend as above, then
follow the mobile README to run the app and configure `API_BASE_URL` for an
emulator or device. The mobile app uses the same API and demo profiles as the
website; it does not provide persistent chat because the backend has no
messaging API. Replace the sample mobile app identifiers and configure
platform signing before publishing store builds.

Choose a demo profile in the header to explore its feed. Seeded accounts are marked verified for demonstration and use stable IDs. The sandbox verification panel can also simulate an identity response. It accepts a sandbox authorization reference and simulated verified gender/age only; the app never accepts or stores Aadhaar numbers.

## Deploy to Vercel

The frontend is Vercel-ready as a standalone Next.js app. For a deployment from this repo, set the Vercel project root to `frontend` or keep the repo root and use the included `vercel.json` configuration. In Vercel Project Settings, add:

```bash
NEXT_PUBLIC_API_URL=https://your-fastapi-backend.example.com
```

The backend remains a separate Python service and is not deployed with the Next.js app by default. For local work, copy `frontend/.env.example` to `frontend/.env.local` and change the value as needed.

## Optional Gemini matching

The app runs locally without a Gemini key using its deterministic structured-profile scoring path. To enable Gemini 2.5 Flash for structured onboarding extraction and match reports, set `GEMINI_API_KEY` in `backend/.env`, then restart the API. Profile and preference details are sent to the configured model when this integration is enabled.

## KYC provider setup

`KYC_MODE=sandbox` is the Codespaces default. For a provider integration, set `KYC_MODE=oauth`, `KYC_OAUTH_TOKEN_URL`, `KYC_OAUTH_IDENTITY_URL`, `KYC_OAUTH_CLIENT_ID`, and `KYC_OAUTH_CLIENT_SECRET`. Implement or configure the provider's OAuth token and identity response contract in `backend/services/kyc.py`; the identity response must include `reference_id` (or `sub`), `verified_gender`, and integer `verified_age`. Only a SHA-256 reference hash, verified gender, verified age, and verification state are persisted. Never send Aadhaar digits through this application.

## Safety and matching rules

- Both people must have a verified identity before eligibility or behavioral model evaluation.
- Verified gender must match unless both accounts explicitly set `allow_coed_living=true`.
- Rent budgets, deposits, utility sharing, commute distance, and lifestyle vectors contribute to the compatibility report.
- The database stores profile preferences and a 64-dimensional lifestyle vector in pgvector. No Aadhaar number is collected.

The sandbox is for local development and is not an identity provider or production verification service. Production deployments should integrate only a provider and authorization flow approved for their jurisdiction and use case.
