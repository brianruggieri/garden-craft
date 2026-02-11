# GardenCraft - Quick Start Guide

## Using OpenAI to Generate Garden Layouts

Your app now correctly uses OpenAI's Chat Completions API to generate intelligent garden layouts based on companion planting, sun orientation, and spacing requirements.

## Setup (5 minutes)

### 1. Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-...`)

### 2. Configure Your Environment

**Option A: .env File (Recommended for local dev)**
```bash
cp .env.example .env
# Edit .env and set your key:
# OPENAI_API_KEY=sk-your-actual-key-here
```

The server now automatically loads `.env` files - no need to manually export!

**Option B: Environment Variable (for production/CI)**
```bash
export OPENAI_API_KEY="sk-your-actual-key-here"
```

### 3. Start the Application

**Terminal 1 - Start the backend server:**
```bash
npm run dev:server
```

You should see:
```
Garden Craft AI server running on http://localhost:8787 (local port 8787)
MCP SSE enabled: yes
```

**Terminal 2 - Start the frontend:**
```bash
npm run dev
```

You should see:
```
VITE v6.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 4. Use the App

1. Open http://localhost:5173 in your browser
2. **Select Provider**: Choose "OpenAI" from the AI Provider dropdown
3. **API Key** (optional): 
   - If you set `OPENAI_API_KEY` in your environment, leave this blank
   - Otherwise, paste your API key here
4. **Design Your Garden**:
   - Click "Add Bed" to create garden beds
   - Adjust bed dimensions and positions
   - Select vegetables from the seed catalog
   - Increase priority (slider) for vegetables you want to plant
5. **Generate Layout**: Click "Generate Layout with AI"
6. Watch as OpenAI creates an optimized companion planting layout!

## How It Works

1. **You design** the physical space (beds, dimensions)
2. **You select** which vegetables to plant
3. **OpenAI analyzes**:
   - Companion planting relationships (which plants help/hurt each other)
   - Spacing requirements for each variety
   - Sun orientation and light needs
   - Bed dimensions and constraints
4. **AI generates** an optimized placement plan with reasoning for each plant

## Supported Models

The app uses `gpt-4o` by default (fast, cost-effective, highly capable).

You can override the model:
- Set `OPENAI_MODEL=gpt-4-turbo` in your environment, or
- Edit `garden-craft/server/providers/openaiProvider.js` line 4

Available models:
- `gpt-4o` (default, recommended) - ~$2.50 per 1M input tokens
- `gpt-4-turbo` - Similar performance, slightly cheaper
- `gpt-4` - Most capable, more expensive
- `gpt-3.5-turbo` (cheaper, less sophisticated) - ~$0.50 per 1M input tokens

💡 **Cost estimate:** Each garden layout generation uses ~2,000-5,000 tokens ($0.01-0.02 with gpt-4o)

## Troubleshooting

### "OpenAI API key missing" error
- Make sure you set `OPENAI_API_KEY` in your environment OR entered it in the UI
- Check the key starts with `sk-`
- Restart the dev server after setting environment variables

### "Optimization request failed (401)"
- Your API key is invalid or expired
- Generate a new key at platform.openai.com

### "Optimization request failed (429)"
- You've hit rate limits or are out of credits
- Check your usage at platform.openai.com
- Add credits or wait for rate limit to reset

### "Rate limit or quota exceeded" (429 error)
- **Free tier keys** have very strict limits (3 requests/min, 200 requests/day)
- **Solution**: Add credits at [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
- Paid accounts get much higher limits (500+ requests/min)
- Or wait a few minutes between requests on free tier

### Layout generation takes a long time
- First request may take 5-15 seconds (model warming up)
- Subsequent requests are usually faster (2-5 seconds)
- Complex gardens with many vegetables take longer

### App won't start
- Check both terminals for errors
- Make sure ports 5173 and 8787 are available
- Run `npm install` if you just pulled changes

## Important Notes

### OpenAI API Costs
- This app uses the OpenAI API which **costs money** per request
- Free tier has strict rate limits (may need to wait between requests)
- Recommended: Add at least $5 credit for smooth testing
- Monitor usage at [platform.openai.com/usage](https://platform.openai.com/usage)

### Rate Limits
- **Free tier**: 3 requests/min, 200/day
- **Paid tier**: 500+ requests/min, 10,000+/day
- If you hit limits, wait or add credits to upgrade

## What's Next?

- **Save/Load Gardens**: Use the save buttons to persist your garden designs
- **Experiment with Styles**: Try different optimization goals
- **Try Other Providers**: The app also supports Gemini, Anthropic, and a local mock provider
- **OAuth Flow**: For production use, implement the OAuth flow to avoid storing API keys

## Security Note

⚠️ **Never commit `.env` files with real API keys to git!**

The `.env.example` file is safe to commit (it has placeholder values).

## Architecture

- **Frontend** (React + TypeScript): Garden design UI
- **Backend** (Express): AI provider abstraction, keeps API keys server-side
- **Providers**: Modular adapters for OpenAI, Gemini, Anthropic
- **Smart Prompts**: Rich context about companion planting, spacing, sun needs

Your API keys stay on the server and are never sent to the browser.

## Testing

Run the test suite:
```bash
npm run test
```

All 12 tests should pass, including OpenAI provider tests (using mocks).

---

**Need help?** Check the main README.md or inspect `server/providers/openaiProvider.js` to see how the integration works.