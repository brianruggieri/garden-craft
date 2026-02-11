# Security Guidelines

## 🔒 Environment Variables & API Keys

### ✅ Current Status

Your `.env` file is now properly gitignored and will NOT be committed to git.

### 📋 Security Checklist

- [x] `.env` is in `.gitignore`
- [x] `.env.example` contains only placeholder values (safe to commit)
- [ ] Real API keys are only in `.env` (never in code)
- [ ] `.env` is never shared via Slack/email/screenshots
- [ ] Team members create their own `.env` from `.env.example`

### 🚨 What Should NEVER Be Committed

**NEVER commit these to git:**
- `.env` files with real values
- API keys (OpenAI, Anthropic, Google, etc.)
- OAuth client secrets
- Database passwords
- Private keys (`.pem`, `.key` files)
- Access tokens

**Safe to commit:**
- `.env.example` (with placeholders like `your-key-here`)
- Configuration templates
- Documentation about what keys are needed

### 🛡️ Best Practices

#### 1. Setting Up Environment Variables

**Local Development:**
```bash
# Copy the example
cp .env.example .env

# Edit .env with your real keys
nano .env  # or vim, code, etc.

# NEVER commit .env
git status  # should NOT show .env as untracked
```

**Server/Production:**
```bash
# Use environment variables directly (no .env file)
export OPENAI_API_KEY="sk-..."
export PORT=8787

# Or use your platform's secrets management
# - Heroku: heroku config:set OPENAI_API_KEY=sk-...
# - Vercel: vercel env add OPENAI_API_KEY
# - AWS: Use Secrets Manager
# - Docker: Use secrets or env_file (gitignored)
```

#### 2. Checking Before Commit

Always verify before committing:
```bash
# Check git status
git status

# Make sure .env is NOT listed
# If it shows up, add it to .gitignore immediately!

# Check what will be committed
git diff --cached

# Search for potential secrets
git diff --cached | grep -iE "(api[_-]?key|secret|token|password)"
```

#### 3. If You Accidentally Commit a Secret

**DON'T PANIC, but act quickly:**

```bash
# 1. Remove the file from git history
git rm --cached .env
git commit -m "Remove .env from tracking"

# 2. Add to .gitignore if not already there
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"

# 3. ROTATE THE SECRET IMMEDIATELY
# - Generate a new API key at the provider
# - Revoke the old key
# - Update your local .env with the new key
```

**If already pushed to GitHub:**
1. Assume the secret is compromised
2. Rotate it immediately at the provider
3. Consider using `git filter-branch` or BFG Repo-Cleaner to remove from history
4. Force push (if you own the repo and can coordinate with team)

#### 4. Sharing Keys with Team

**❌ NEVER:**
- Email API keys
- Post in Slack/Discord
- Include in screenshots
- Commit to git

**✅ INSTEAD:**
- Use a password manager (1Password, LastPass, Bitwarden)
- Use your platform's secrets management
- Share via secure, encrypted channels
- Let each developer get their own keys when possible

### 🔍 API Key Best Practices

#### OpenAI API Keys
- Get your own key at [platform.openai.com](https://platform.openai.com)
- Set usage limits to prevent surprise bills
- Rotate keys periodically
- Use separate keys for dev/staging/production
- Monitor usage at platform.openai.com/usage

#### Environment Variable Hierarchy

The app checks for API keys in this order:
1. API key passed in request body (UI input)
2. OAuth token (if provider is connected via OAuth)
3. Environment variable (e.g., `OPENAI_API_KEY`)

**For local dev:** Use environment variables (most convenient)
**For production:** Use OAuth or platform secrets manager

### 📝 Current Environment Variables

See `.env.example` for the complete list. Key variables:

```bash
# Required for OpenAI provider
OPENAI_API_KEY=sk-...

# Optional configuration
OPENAI_MODEL=gpt-4o
PORT=8787
BASE_URL=http://localhost:8787

# OAuth (optional, for production)
OAUTH_REDIRECT_BASE_URL=https://your-app.com
```

### 🚀 Production Deployment

When deploying to production:

1. **Use platform secrets:**
   - Don't use `.env` files in production
   - Use environment variables or secrets manager
   - Encrypt secrets at rest

2. **Restrict API keys:**
   - Use IP restrictions if available
   - Set rate limits
   - Monitor for unusual usage

3. **Implement OAuth:**
   - Let users connect their own API accounts
   - Store tokens encrypted in database
   - Implement token refresh and revocation

4. **Add authentication:**
   - Protect admin endpoints
   - Rate limit public endpoints
   - Add request signing for MCP endpoints

### 🆘 Security Incident Response

**If you suspect a key is compromised:**

1. **Immediately** revoke/rotate the key at the provider
2. Check usage logs for unauthorized activity
3. Update all environments with new key
4. Review git history for accidental commits
5. Document the incident and response

### 📚 Additional Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [12 Factor App: Config](https://12factor.net/config)

---

**Remember:** Secrets in git history are permanent. Prevention is always better than cleanup.