# GardenCraft Visual Designer

A garden planning app designed as a practical tool for mapping beds, placing plants, and testing layout ideas. GardenCraft blends a tactile canvas with an AI‑assisted optimizer.

---

## Highlights

- **Interactive garden canvas** with beds, plant placements, and spatial feedback.
- **AI‑assisted layouts** via provider adapters (Gemini, OpenAI, Anthropic).
- **Local procedural fallback** (no tokens, great for demos).
- **Server‑side provider layer** so keys never touch the browser.
- **AI settings UI** with provider selection, model overrides, API keys, and OAuth trigger.

---

## Architecture Overview

**Client (Vite + React)**  
- Renders the canvas and plant placements.  
- Calls the AI server through `POST /api/optimize`.  
- Provides AI settings panel for provider/model/key/OAuth.

**AI Server (Express)**  
- Provider registry with adapters for:  
  - `local` (procedural generator)  
  - `gemini`  
  - `openai`  
  - `anthropic`  
- `/api/optimize` routes to the selected provider.  
- OAuth scaffold endpoints (PKCE helper).  
- Credentials remain **server‑side**.

---

## Prerequisites

- Node.js v22 LTS (Active LTS through April 2027)
- npm v10+ (included with Node v22)

---

## Quick Start

### 1) Install dependencies
```garden-craft/README.md#L1-L3
npm install
```

### 2) Start the AI server
```garden-craft/README.md#L1-L3
npm run dev:server
```

Server runs at `http://localhost:8787`.

### 3) Start the Vite app
```garden-craft/README.md#L1-L3
npm run dev
```

Vite runs at `http://localhost:3000`.

---

## Environment Variables

### Server (AI Providers)
Set these on the **server** only:

**Gemini**
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `GEMINI_MODEL` (optional)

**OpenAI**
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)

**Anthropic**
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional)

---

## OAuth (Intentional, Not Fully Complete Yet)

OAuth is **planned and scaffolded**, but not fully production‑ready. The endpoints exist and can be wired, but token persistence and provider‑specific nuances still need hardening.

OAuth endpoints:
- `GET /oauth/:provider/start`
- `GET /oauth/:provider/callback`
- `GET /oauth/:provider/status`

Configuration (per provider):

**Gemini / Google**
- `GEMINI_OAUTH_AUTHORIZE_URL` (or `GOOGLE_OAUTH_AUTHORIZE_URL`)
- `GEMINI_OAUTH_TOKEN_URL` (or `GOOGLE_OAUTH_TOKEN_URL`)
- `GEMINI_OAUTH_CLIENT_ID`
- `GEMINI_OAUTH_CLIENT_SECRET`
- `GEMINI_OAUTH_SCOPES` (optional)
- `GEMINI_OAUTH_REDIRECT_URI` (optional, defaults to `${BASE_URL}/oauth/gemini/callback`)

**OpenAI**
- `OPENAI_OAUTH_AUTHORIZE_URL`
- `OPENAI_OAUTH_TOKEN_URL`
- `OPENAI_OAUTH_CLIENT_ID`
- `OPENAI_OAUTH_CLIENT_SECRET`
- `OPENAI_OAUTH_SCOPES` (optional)
- `OPENAI_OAUTH_REDIRECT_URI` (optional, defaults to `${BASE_URL}/oauth/openai/callback`)

**Anthropic**
- `ANTHROPIC_OAUTH_AUTHORIZE_URL`
- `ANTHROPIC_OAUTH_TOKEN_URL`
- `ANTHROPIC_OAUTH_CLIENT_ID`
- `ANTHROPIC_OAUTH_CLIENT_SECRET`
- `ANTHROPIC_OAUTH_SCOPES` (optional)
- `ANTHROPIC_OAUTH_REDIRECT_URI` (optional, defaults to `${BASE_URL}/oauth/anthropic/callback`)

**Server base URLs**
- `BASE_URL` (public server URL used for redirect URIs)
- `OAUTH_REDIRECT_BASE_URL` (optional override)
- `OAUTH_POST_AUTH_REDIRECT` (optional)

---

## Client AI Server Override (Optional)

If the app and AI server run on different hosts, override the AI server:

- `VITE_AI_SERVER_URL` (compile‑time, e.g. `http://192.168.1.247:8787`)
- `localStorage` key: `GARDENCRAFT_AI_SERVER_URL` (runtime override)

Example:
```garden-craft/README.md#L1-L1
localStorage.setItem('GARDENCRAFT_AI_SERVER_URL', 'http://192.168.1.247:8787')
```

---

## API Surface

### `POST /api/optimize`
Routes to the selected provider and returns a normalized layout.

Example payload:
```garden-craft/README.md#L1-L18
{
  "provider": "local",
  "beds": [...],
  "seeds": [...],
  "sunOrientation": "South",
  "style": {},
  "optimizationGoals": [],
  "auth": { "apiKey": "..." },
  "model": "optional-model-id"
}
```

### `GET /api/providers`
Returns available providers and OAuth support.

---

## Project Structure (Key Paths)

- `services/geminiService.ts` — client API wrapper (server‑backed).
- `server/index.js` — Express server entry.
- `server/providers/*` — provider adapters.
- `server/oauth/*` — OAuth PKCE helpers.

---

## Roadmap (Future Vision)

1. **Account‑level provider profiles**
   - Save provider + model presets per user.
   - Encrypt and store BYOK tokens.

2. **Layout intelligence upgrades**
   - Constraint solver for adjacency, crop rotation, succession.
   - Multi‑objective optimization (yield, biodiversity, aesthetics).

3. **Generative visualization**
   - Animated growth stages.
   - Seasonal transitions + sun path simulation.

4. **Collaboration**
   - Shareable garden blueprints.
   - Multiplayer co‑design sessions.

5. **Export & integrations**
   - PDF planting plans.
   - Calendar reminders + harvest schedule.

---

## Notes

This repo contains an evolving implementation of a garden‑planning UI and its AI integration layer. Expect ongoing changes to the canvas, provider settings, and related interface wiring as the feature set is expanded.
