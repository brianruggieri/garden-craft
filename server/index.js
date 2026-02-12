import { config } from "dotenv";
import express from "express";
import { getProvider, listProviders } from "./providers/index.js";
import { createOAuthRouter } from "./oauth/index.js";
import { loadOAuthProviders } from "./oauth/providers.js";
import { createMcpSseRouter } from "./mcp/sseRouter.js";
import { VEGGIE_METADATA } from "./veggieMetadata.js";
import { getPlantCatalog } from "./plantCatalogRepo.js";
import { ForceDirectedGardenPacker } from "./packer/ForceDirectedGardenPacker.js";
import { HierarchicalCirclePacker } from "./packer/HierarchicalCirclePacker.js";

// Load .env file if it exists
config();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "500kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

/**
 * In-memory token store (single-instance, dev-friendly).
 * For production, replace with a durable, per-user, encrypted store.
 *
 * Security notes:
 * - This store keeps tokens only in memory for local/dev use.
 * - We intentionally avoid logging token contents anywhere.
 * - The stored shape intentionally separates raw token material from public metadata.
 */
const oauthTokenStore = new Map();

const oauthProviders = loadOAuthProviders(process.env, {
  baseUrl: process.env.BASE_URL || `http://localhost:${port}`,
  redirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL,
  allowIncomplete: true,
  postAuthRedirect: process.env.OAUTH_POST_AUTH_REDIRECT || "/",
});

/**
 * OAuth router hooks.
 *
 * onSuccess: persist minimal token material in-memory without logging sensitive values.
 * - We store the access token (necessary to call provider APIs) but avoid printing it.
 * - We store only a boolean flag if a refresh token exists (do NOT store refresh token raw in logs).
 *
 * onError: avoid echoing raw errors that might contain sensitive token material.
 */
const oauthRouter = createOAuthRouter({
  providers: oauthProviders,
  onSuccess: async (req, { providerId, token }) => {
    const receivedAt = Date.now();
    const expiresInMs =
      typeof token?.expires_in === "number" ? token.expires_in * 1000 : null;

    // Store minimal in-memory entry. We keep accessToken for server-side calls but avoid
    // placing raw tokens into logs or responses. Refresh tokens are noted but not logged.
    oauthTokenStore.set(String(providerId).toLowerCase(), {
      // Access token is required to call provider APIs from server.
      // This stays in the in-memory store only.
      accessToken: token?.access_token || null,
      tokenType: token?.token_type || null,
      // Keep scope string / token metadata for diagnostics (safe to expose).
      scopes: token?.scope || null,
      // Do not store the refresh_token raw in any publicly-served debug endpoint.
      hasRefreshToken: typeof token?.refresh_token === "string",
      // rawToken: token, // intentionally NOT stored for safety in logs/debug endpoints
      receivedAt,
      expiresAt: expiresInMs ? receivedAt + expiresInMs : null,
    });
  },
  onError: async (req, err) => {
    // Avoid printing error objects that could include sensitive token material.
    // Log a concise message and, in dev, an error id could be used to look up more details
    // in a secure internal log if needed.
    console.error("OAuth error during provider flow");
  },
});

/**
 * Health check.
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * Provider list for UI selection.
 */
app.get("/api/providers", (req, res) => {
  res.json({
    providers: listProviders(),
  });
});

/**
 * Plant catalog for client UI.
 */
app.get("/api/catalog", async (req, res) => {
  try {
    const catalog = await getPlantCatalog();
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: "Failed to load plant catalog" });
  }
});

/**
 * OAuth endpoints.
 */
app.get("/oauth/:provider/start", oauthRouter.start);
app.get("/oauth/:provider/callback", oauthRouter.callback);
app.get("/oauth/:provider/status", oauthRouter.status);

/**
 * MCP OAuth discovery endpoint:
 * - Returns a small JSON object advertising OAuth-related endpoints so MCP/ChatGPT
 *   can detect that this server implements OAuth flows.
 * - Uses a `{provider}` placeholder in URLs; the MCP consumer should substitute
 *   the provider id when initiating a flow (e.g. replace `{provider}` with `gemini`).
 *
 * Note: This is intentionally minimal and safe for dev use. Do not expose raw tokens
 * or sensitive details here.
 */
app.get("/mcp/oauth_config", (req, res) => {
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  res.json({
    oauth: {
      authorization_url: `${base}/oauth/{provider}/start`,
      token_url: `${base}/oauth/{provider}/token`,
      device_authorization_url: `${base}/oauth/{provider}/device/start`,
      revoke_url: `${base}/oauth/{provider}/disconnect`,
    },
  });
});

// Root-level discovery endpoint for MCP probes
// Some MCP implementations probe the root path `/oauth_config` (without the /mcp prefix).
// Provide the same minimal discovery object at that path so registration probes succeed
// when ChatGPT or other MCP consumers call <mcp_base>/oauth_config.
app.get("/oauth_config", (req, res) => {
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  res.json({
    oauth: {
      authorization_url: `${base}/oauth/{provider}/start`,
      token_url: `${base}/oauth/{provider}/token`,
      device_authorization_url: `${base}/oauth/{provider}/device/start`,
      revoke_url: `${base}/oauth/{provider}/disconnect`,
    },
    // Advertise the SSE entrypoint as well (useful for MCP/ChatGPT UI)
    sse: {
      url: `${base}/mcp/sse`,
    },
  });
});

// Device Authorization (RFC 8628) endpoints for headless / remote flows.
// - POST /oauth/:provider/device/start  -> starts device flow (returns user_code + verification URIs + a local key)
// - POST /oauth/:provider/device/poll   -> polling endpoint (accepts key in body) to exchange device_code for token
// - GET  /oauth/:provider/device/poll   -> polling endpoint (accepts key in query) for convenience
//
// These endpoints rely on the provider exposing a deviceUrl in the provider config.
// All token material returned by the provider is passed to `onSuccess` (above) and stored
// only in the in-memory oauthTokenStore. The endpoints do NOT echo tokens back to clients.
app.post("/oauth/:provider/device/start", oauthRouter.deviceStart);
app.post("/oauth/:provider/device/poll", oauthRouter.devicePoll);
app.get("/oauth/:provider/device/poll", oauthRouter.devicePoll);

app.get("/oauth/:provider/connected", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const entry = oauthTokenStore.get(providerId);
  const now = Date.now();
  const connected = Boolean(
    entry && (!entry.expiresAt || entry.expiresAt > now),
  );
  if (!connected && entry?.expiresAt && entry.expiresAt <= now) {
    oauthTokenStore.delete(providerId);
  }
  res.json({
    provider: providerId,
    connected,
    expiresAt: entry?.expiresAt || null,
  });
});

/**
 * Debug-only token status (SAFE): returns only non-sensitive metadata.
 * NOTE: For production, remove or protect this endpoint.
 *
 * This endpoint intentionally does NOT return raw tokens or refresh tokens.
 * It exists only to confirm that a provider is connected in the in-memory store.
 */
app.get("/oauth/:provider/token", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const entry = oauthTokenStore.get(providerId);
  if (!entry) {
    res.status(404).json({ error: "No token stored." });
    return;
  }
  res.json({
    provider: providerId,
    receivedAt: entry.receivedAt,
    expiresAt: entry.expiresAt || null,
    tokenType: entry.tokenType || null,
    hasRefreshToken: Boolean(entry.hasRefreshToken),
  });
});

/**
 * Disconnect a provider for the current server (dev-only).
 * This removes the in-memory token entry for the provider so the server will
 * no longer use that provider's OAuth token for API calls.
 *
 * Security: This endpoint does NOT return token material. It only returns a
 * confirmation that the server removed the stored token entry.
 */
app.post("/oauth/:provider/disconnect", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const existed = oauthTokenStore.has(providerId);
  // Remove any stored token material for this provider (in-memory only).
  oauthTokenStore.delete(providerId);
  res.json({ provider: providerId, disconnected: existed });
});

/**
 * Main optimization endpoint.
 * Now uses algorithmic packer by default for reliable, dense layouts.
 * Set usePacker: false to use legacy LLM-coordinate approach.
 */
app.post("/api/optimize", async (req, res) => {
  try {
    const {
      provider: providerId = "local",
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth,
      model,
      usePacker = true, // Default to packer for better results
    } = req.body || {};

    // Use packer approach for better reliability
    if (usePacker && providerId !== "local") {
      try {
        const oauthTokenEntry = oauthTokenStore.get(
          String(providerId).toLowerCase(),
        );

        const resolvedAuth =
          auth ??
          (oauthTokenEntry?.accessToken
            ? {
                oauthAccessToken: oauthTokenEntry.accessToken,
              }
            : undefined);

        // Phase 1: Get semantic plan from LLM
        const semanticPrompt = buildSemanticPlanPrompt({
          beds,
          seeds,
          sunOrientation,
          style,
          optimizationGoals,
        });

        console.log("[SemanticPlanner] Requesting plant selection from LLM...");

        // Direct LLM call without schema validation
        let llmResponse;
        if (providerId === "openai") {
          const OpenAI = (await import("openai")).default;
          const apiKey =
            resolvedAuth?.apiKey ||
            resolvedAuth?.oauthAccessToken ||
            process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error("OpenAI API key missing");
          const client = new OpenAI({ apiKey });

          const response = await client.chat.completions.create({
            model: model || "gpt-4o",
            messages: [
              { role: "system", content: semanticPrompt.system },
              { role: "user", content: semanticPrompt.prompt },
            ],
            response_format: { type: "json_object" },
          });

          llmResponse = response.choices[0]?.message?.content || "{}";
        } else if (providerId === "anthropic") {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const apiKey =
            resolvedAuth?.apiKey ||
            resolvedAuth?.oauthAccessToken ||
            process.env.ANTHROPIC_API_KEY;
          if (!apiKey) throw new Error("Anthropic API key missing");
          const client = new Anthropic({ apiKey });

          const response = await client.messages.create({
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: 2048,
            system: semanticPrompt.system,
            messages: [{ role: "user", content: semanticPrompt.prompt }],
          });

          llmResponse = response.content?.[0]?.text || "{}";
        } else if (providerId === "gemini") {
          const { GoogleGenAI } = await import("@google/generative-ai");
          const apiKey = resolvedAuth?.apiKey || process.env.GEMINI_API_KEY;
          if (!apiKey) throw new Error("Gemini API key missing");
          const client = new GoogleGenAI(apiKey);
          const aiModel = client.models.getGenerativeModel({
            model: model || "gemini-2.0-flash-exp",
          });

          const response = await aiModel.generateContent({
            contents: [semanticPrompt.system, semanticPrompt.prompt].join(
              "\n\n",
            ),
            config: { responseMimeType: "application/json" },
          });

          llmResponse = response?.text ?? "{}";
        } else {
          throw new Error(`Provider ${providerId} not supported for packer`);
        }

        // Parse semantic plan
        const semanticPlan = parseSemanticPlan(llmResponse, beds);
        console.log(
          `[SemanticPlanner] LLM selected ${semanticPlan.beds.reduce((sum, b) => sum + b.plants.reduce((s, p) => s + p.count, 0), 0)} total plants`,
        );

        // Phase 2: Pack plants algorithmically
        const layouts = [];

        for (const bedPlan of semanticPlan.beds) {
          const bed = beds.find((b) => b.id === bedPlan.bedId);
          if (!bed) {
            console.warn(`[Packer] Bed ${bedPlan.bedId} not found, skipping`);
            continue;
          }

          console.log(
            `[Packer] Packing ${bedPlan.plants.length} plant types into bed ${bed.name}...`,
          );

          const packer = new GardenPacker(bed, {
            sunOrientation,
            padding: 0.5,
            allowRootOverlap: true,
            companionProximity: 12,
          });

          const packerInput = convertPlanToPackerFormat({
            beds: [bedPlan],
          });

          const result = packer.packPlants(packerInput[0].plants);

          console.log(
            `[Packer] Placed ${result.stats.placed}/${result.stats.placed + result.stats.failed} plants (${result.stats.successRate} success)`,
          );
          console.log(
            `[Packer] Packing density: ${result.stats.packingDensity} of bed area`,
          );

          if (result.failedPlants.length > 0) {
            console.warn(
              `[Packer] Failed to place: ${result.failedPlants.map((p) => p.veggieType).join(", ")}`,
            );
          }

          layouts.push({
            bedId: bed.id,
            placements: result.placements,
          });
        }

        return res.json({
          provider: providerId,
          layouts,
        });
      } catch (err) {
        console.error("[Packer] Error:", err);
        console.log("[Packer] Falling back to legacy LLM-coordinate approach");
        // Fall through to legacy approach below
      }
    }

    const provider = getProvider(providerId);
    if (!provider) {
      res.status(400).json({ error: "Unknown provider." });
      return;
    }

    const oauthTokenEntry = oauthTokenStore.get(
      String(providerId).toLowerCase(),
    );

    // Normalize auth so providers always receive either an object or `undefined`,
    // never `null`. Some provider factories expect an object and may throw when
    // receiving `null`. Use the nullish coalescing operator so an explicit
    // `auth: {}` or other falsy-but-present values are respected.
    const resolvedAuth =
      auth ??
      (oauthTokenEntry?.accessToken
        ? {
            oauthAccessToken: oauthTokenEntry.accessToken,
          }
        : undefined);

    const rawLayouts = await provider.generateLayout({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth: resolvedAuth,
      model,
    });

    // Validate bounds for diagnostic purposes (logs only, doesn't block)
    if (Array.isArray(rawLayouts) && Array.isArray(beds)) {
      rawLayouts.forEach((layout) => {
        const bed = beds.find((b) => b.id === layout.bedId);
        if (!bed || !Array.isArray(layout.placements)) return;

        const violations = [];
        layout.placements.forEach((plant) => {
          const radius = (plant.size || 0) / 2;
          const leftEdge = plant.x - radius;
          const rightEdge = plant.x + radius;
          const topEdge = plant.y - radius;
          const bottomEdge = plant.y + radius;

          if (
            leftEdge < 0 ||
            rightEdge > bed.width ||
            topEdge < 0 ||
            bottomEdge > bed.height
          ) {
            violations.push({
              veggieType: plant.veggieType,
              center: `(${plant.x}", ${plant.y}")`,
              size: `${plant.size}"`,
              bounds: `x:[${leftEdge.toFixed(1)}, ${rightEdge.toFixed(1)}], y:[${topEdge.toFixed(1)}, ${bottomEdge.toFixed(1)}]`,
              bedBounds: `x:[0, ${bed.width}], y:[0, ${bed.height}]`,
            });
          }
        });

        if (violations.length > 0) {
          console.warn(
            `⚠️  Bounds violations detected in bed "${bed.name || bed.id}" (${bed.width}" × ${bed.height}"):`,
          );
          violations.forEach((v) => {
            console.warn(
              `   ${v.veggieType} @ ${v.center} size:${v.size} extends to ${v.bounds} (bed: ${v.bedBounds})`,
            );
          });
        }
      });
    }

    // Normalize provider responses: ensure placements use canonical veggie types
    // based on server-side VEGGIE_METADATA and accept provider aliases such as
    // "plants". We also map common field names (e.g. spacing -> size) so the UI
    // receives a consistent `placements` array.
    const canonicalKeys = Object.keys(VEGGIE_METADATA || {});

    const normalizeType = (value) => {
      if (!value) return value;
      const key = String(value).trim();
      if (!key) return key;
      if (VEGGIE_METADATA[key]) return key;
      const title = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      if (VEGGIE_METADATA[title]) return title;
      const lower = key.toLowerCase();
      const found = canonicalKeys.find((k) => k.toLowerCase() === lower);
      if (found) return found;
      return key;
    };

    const makeId = (maybeId, idx) =>
      maybeId !== undefined && maybeId !== null
        ? String(maybeId)
        : `p-${Date.now().toString(36)}-${idx}`;

    const normalizePlantToPlacement = (plant = {}, idx = 0) => {
      const typeCandidate = plant.veggieType || plant.type || plant.name || "";
      const veggieType = normalizeType(typeCandidate);
      const varietyName =
        plant.varietyName || plant.variety || `Standard ${veggieType}`;
      const x =
        typeof plant.x === "number"
          ? plant.x
          : Number(plant.left ?? plant.cx ?? 0);
      const y =
        typeof plant.y === "number"
          ? plant.y
          : Number(plant.top ?? plant.cy ?? 0);
      const size = plant.size ?? plant.spacing ?? plant.spread ?? null;

      return {
        id: makeId(plant.id, idx),
        veggieType,
        varietyName,
        x,
        y,
        size,
        spacingAnalysis: plant.spacingAnalysis ?? plant.spacingNotes ?? null,
        placementReasoning: plant.placementReasoning ?? plant.reasoning ?? null,
        companionInsights:
          plant.companionInsights ?? plant.companionNotes ?? null,
      };
    };

    const layouts = (Array.isArray(rawLayouts) ? rawLayouts : []).map(
      (layout) => {
        // Accept `plants` as an alias for placements (some providers return `plants`).
        const sourcePlants = Array.isArray(layout?.plants)
          ? layout.plants
          : null;
        const sourcePlacements = Array.isArray(layout?.placements)
          ? layout.placements
          : null;
        const source = sourcePlacements ?? sourcePlants ?? [];

        // If provider returned `plants`, normalize each plant object into a placement.
        const mapped = (Array.isArray(source) ? source : []).map(
          (item, idx) => {
            // If the item already looks like a placement with an id/veggieType/coords,
            // normalize the veggieType and map `spacing`->`size` if present.
            const looksLikePlacement =
              item &&
              (item.veggieType || item.varietyName) &&
              (item.x !== undefined ||
                item.left !== undefined ||
                item.cx !== undefined);

            if (looksLikePlacement) {
              const veggieType = normalizeType(
                item.veggieType || item.type || "",
              );
              return {
                id: makeId(item.id, idx),
                veggieType,
                varietyName:
                  item.varietyName || item.variety || `Standard ${veggieType}`,
                x:
                  typeof item.x === "number"
                    ? item.x
                    : Number(item.left ?? item.cx ?? 0),
                y:
                  typeof item.y === "number"
                    ? item.y
                    : Number(item.top ?? item.cy ?? 0),
                size: item.size ?? item.spacing ?? item.spread ?? null,
                spacingAnalysis:
                  item.spacingAnalysis ?? item.spacingNotes ?? null,
                placementReasoning:
                  item.placementReasoning ?? item.reasoning ?? null,
                companionInsights:
                  item.companionInsights ?? item.companionNotes ?? null,
              };
            }

            // Fallback normalization for unexpected shapes
            return normalizePlantToPlacement(item, idx);
          },
        );

        return {
          ...layout,
          // Ensure `placements` is always a populated, normalized array for the UI.
          placements: mapped,
        };
      },
    );

    res.json({ provider: provider.id, layouts });
  } catch (err) {
    console.error("Optimize error:", err);
    res.status(500).json({
      error: err.message || "Optimization failed.",
    });
  }
});

/**
 * Algorithmic packer endpoint - uses semantic planning + circle packing
 *
 * Two-phase approach:
 * 1. LLM generates semantic plan (WHAT plants, HOW MANY, WHY)
 * 2. Circle packer algorithm determines WHERE (coordinates)
 *
 * This is deterministic, guaranteed to produce valid layouts, and much more
 * reliable than asking LLMs to do spatial math.
 */
app.post("/api/optimize-packer", async (req, res) => {
  try {
    const {
      provider: providerId = "openai",
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth,
      model,
      usePacker = true, // Toggle to compare with old approach
    } = req.body || {};

    if (!usePacker) {
      // Fall back to old LLM-coordinate approach
      return res.redirect(307, "/api/optimize");
    }

    const provider = getProvider(providerId);
    if (!provider) {
      res.status(400).json({ error: "Unknown provider." });
      return;
    }

    const oauthTokenEntry = oauthTokenStore.get(
      String(providerId).toLowerCase(),
    );

    const resolvedAuth =
      auth ??
      (oauthTokenEntry?.accessToken
        ? {
            oauthAccessToken: oauthTokenEntry.accessToken,
          }
        : undefined);

    // Phase 1: Get semantic plan from LLM (plant selection + quantities)
    const semanticPrompt = buildSemanticPlanPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    console.log("[SemanticPlanner] Requesting plant selection from LLM...");

    // For the packer endpoint, we bypass the provider's generateLayout method
    // and call the LLM directly without schema validation, since semantic planner
    // uses a different schema than the standard layout schema.
    let llmResponse;

    // Direct LLM call based on provider type
    if (providerId === "openai") {
      const OpenAI = (await import("openai")).default;
      const apiKey =
        resolvedAuth?.apiKey ||
        resolvedAuth?.oauthAccessToken ||
        process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key missing");
      }
      const client = new OpenAI({ apiKey });

      const response = await client.chat.completions.create({
        model: model || "gpt-4o",
        messages: [
          { role: "system", content: semanticPrompt.system },
          { role: "user", content: semanticPrompt.prompt },
        ],
        response_format: { type: "json_object" },
      });

      llmResponse = response.choices[0]?.message?.content || "{}";
    } else if (providerId === "anthropic") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const apiKey =
        resolvedAuth?.apiKey ||
        resolvedAuth?.oauthAccessToken ||
        process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Anthropic API key missing");
      }
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: semanticPrompt.system,
        messages: [{ role: "user", content: semanticPrompt.prompt }],
      });

      llmResponse = response.content?.[0]?.text || "{}";
    } else if (providerId === "gemini") {
      const { GoogleGenAI } = await import("@google/generative-ai");
      const apiKey = resolvedAuth?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key missing");
      }
      const client = new GoogleGenAI(apiKey);
      const aiModel = client.models.getGenerativeModel({
        model: model || "gemini-2.0-flash-exp",
      });

      const response = await aiModel.generateContent({
        contents: [semanticPrompt.system, semanticPrompt.prompt].join("\n\n"),
        config: { responseMimeType: "application/json" },
      });

      llmResponse = response?.text ?? "{}";
    } else {
      throw new Error(
        `Provider ${providerId} not supported for packer endpoint`,
      );
    }

    // Debug logging
    console.log(
      "[SemanticPlanner] Raw LLM response:",
      llmResponse.substring(0, 500),
    );

    // Parse and validate semantic plan
    const semanticPlan = parseSemanticPlan(llmResponse, beds);
    console.log(
      `[SemanticPlanner] LLM selected ${semanticPlan.beds.reduce((sum, b) => sum + b.plants.reduce((s, p) => s + p.count, 0), 0)} total plants`,
    );

    // Phase 2: Use circle packer to place plants algorithmically
    const layouts = [];

    for (const bedPlan of semanticPlan.beds) {
      const bed = beds.find((b) => b.id === bedPlan.bedId);
      if (!bed) {
        console.warn(`[Packer] Bed ${bedPlan.bedId} not found, skipping`);
        continue;
      }

      console.log(
        `[Packer] Packing ${bedPlan.plants.length} plant types into bed ${bed.name}...`,
      );

      const packer = new GardenPacker(bed, {
        sunOrientation,
        padding: 0.5,
        allowRootOverlap: true,
        companionProximity: 12,
      });

      // Convert semantic plan to packer format
      const packerInput = convertPlanToPackerFormat({
        beds: [bedPlan],
      });

      // Pack plants
      const result = packer.packPlants(packerInput[0].plants);

      console.log(
        `[Packer] Placed ${result.stats.placed}/${result.stats.placed + result.stats.failed} plants (${result.stats.successRate} success)`,
      );
      console.log(
        `[Packer] Packing density: ${result.stats.packingDensity} of bed area`,
      );

      if (result.failedPlants.length > 0) {
        console.warn(
          `[Packer] Failed to place: ${result.failedPlants.map((p) => p.veggieType).join(", ")}`,
        );
      }

      layouts.push({
        bedId: bed.id,
        placements: result.placements,
        strategy: bedPlan.strategy,
        stats: result.stats,
      });
    }

    res.json({
      provider: provider.id,
      method: "algorithmic-packer",
      semanticPlan: {
        overallReasoning: semanticPlan.overallReasoning,
        beds: semanticPlan.beds.map((b) => ({
          bedId: b.bedId,
          plantCount: b.plants.reduce((sum, p) => sum + p.count, 0),
          strategy: b.strategy,
        })),
      },
      layouts,
    });
  } catch (err) {
    console.error("[Packer] Error:", err);
    res.status(500).json({
      error: err.message || "Packer optimization failed.",
    });
  }
});

/**
 * Hierarchical force-directed packer endpoint - Advanced two-level clustering
 *
 * Uses force-directed layout with hierarchical clustering:
 * 1. Groups plants by type into clusters
 * 2. Packs cluster meta-circles using force simulation (attraction/repulsion)
 * 3. Packs individual plants within each cluster boundary
 * 4. Applies Lloyd relaxation for refinement
 *
 * Features:
 * - Tunable force parameters (intra_group_attraction, inter_group_repulsion, etc.)
 * - Deterministic seeded randomness
 * - Visual plant-type clustering
 * - Companion plant proximity
 * - Antagonist separation
 */
app.post("/api/optimize-hierarchical", async (req, res) => {
  try {
    const {
      provider: providerId = "openai",
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth,
      model,
      // Force-directed packing configuration
      config = {},
    } = req.body || {};

    const provider = getProvider(providerId);
    if (!provider) {
      res.status(400).json({ error: "Unknown provider." });
      return;
    }

    const oauthTokenEntry = oauthTokenStore.get(
      String(providerId).toLowerCase(),
    );

    const resolvedAuth =
      auth ??
      (oauthTokenEntry?.accessToken
        ? {
            oauthAccessToken: oauthTokenEntry.accessToken,
          }
        : undefined);

    // Phase 1: Get semantic plan from LLM (plant selection + quantities)
    const semanticPrompt = buildSemanticPlanPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    console.log("[HierarchicalPacker] Requesting plant selection from LLM...");

    let llmResponse;

    // Direct LLM call based on provider type
    if (providerId === "openai") {
      const OpenAI = (await import("openai")).default;
      const apiKey =
        resolvedAuth?.apiKey ||
        resolvedAuth?.oauthAccessToken ||
        process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key missing");
      }
      const client = new OpenAI({ apiKey });

      const response = await client.chat.completions.create({
        model: model || "gpt-4o",
        messages: [
          { role: "system", content: semanticPrompt.system },
          { role: "user", content: semanticPrompt.prompt },
        ],
        response_format: { type: "json_object" },
      });

      llmResponse = response.choices[0]?.message?.content || "{}";
    } else if (providerId === "anthropic") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const apiKey =
        resolvedAuth?.apiKey ||
        resolvedAuth?.oauthAccessToken ||
        process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Anthropic API key missing");
      }
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: semanticPrompt.system,
        messages: [{ role: "user", content: semanticPrompt.prompt }],
      });

      llmResponse = response.content?.[0]?.text || "{}";
    } else if (providerId === "gemini") {
      const { GoogleGenAI } = await import("@google/generative-ai");
      const apiKey = resolvedAuth?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key missing");
      }
      const client = new GoogleGenAI(apiKey);
      const aiModel = client.models.getGenerativeModel({
        model: model || "gemini-2.0-flash-exp",
      });

      const response = await aiModel.generateContent({
        contents: [semanticPrompt.system, semanticPrompt.prompt].join("\n\n"),
        config: { responseMimeType: "application/json" },
      });

      llmResponse = response?.text ?? "{}";
    } else {
      throw new Error(
        `Provider ${providerId} not supported for hierarchical packer endpoint`,
      );
    }

    // Parse and validate semantic plan
    const semanticPlan = parseSemanticPlan(llmResponse, beds);
    console.log(
      `[HierarchicalPacker] LLM selected ${semanticPlan.beds.reduce((sum, b) => sum + b.plants.reduce((s, p) => s + p.count, 0), 0)} total plants`,
    );

    // Phase 2: Use hierarchical force-directed packer
    const layouts = [];

    for (const bedPlan of semanticPlan.beds) {
      const bed = beds.find((b) => b.id === bedPlan.bedId);
      if (!bed) {
        console.warn(
          `[HierarchicalPacker] Bed ${bedPlan.bedId} not found, skipping`,
        );
        continue;
      }

      console.log(
        `[HierarchicalPacker] Packing ${bedPlan.plants.length} plant types into bed ${bed.name || bed.id}...`,
      );

      // Merge user config with defaults
      const packerConfig = {
        intra_group_attraction: config.intra_group_attraction ?? 0.3,
        inter_group_repulsion: config.inter_group_repulsion ?? 0.2,
        collision_strength: config.collision_strength ?? 0.8,
        boundary_force: config.boundary_force ?? 0.5,
        cluster_padding: config.cluster_padding ?? 2,
        min_spacing: config.min_spacing ?? 0.5,
        max_iterations: config.max_iterations ?? 500,
        convergence_threshold: config.convergence_threshold ?? 0.01,
        damping: config.damping ?? 0.9,
        random_seed: config.random_seed ?? null,
      };

      const packer = new ForceDirectedGardenPacker(bed, {
        sunOrientation,
        ...packerConfig,
      });

      // Convert semantic plan to packer format
      const packerInput = convertPlanToPackerFormat({
        beds: [bedPlan],
      });

      // Pack plants using hierarchical force-directed algorithm
      const result = packer.packPlants(packerInput[0].plants);

      console.log(
        `[HierarchicalPacker] Placed ${result.stats.placed} plants (${result.stats.converged ? "converged" : "max iterations"})`,
      );
      console.log(
        `[HierarchicalPacker] Packing density: ${result.stats.packingDensity}, clusters: ${result.stats.clusters}`,
      );

      if (result.violations.bounds.length > 0) {
        console.warn(
          `[HierarchicalPacker] ${result.violations.bounds.length} bounds violations detected`,
        );
      }

      if (result.violations.collisions.length > 0) {
        console.warn(
          `[HierarchicalPacker] ${result.violations.collisions.length} collisions detected`,
        );
      }

      layouts.push({
        bedId: bed.id,
        placements: result.placements,
        strategy: bedPlan.strategy,
        stats: result.stats,
        clusters: result.clusters,
        violations: result.violations,
      });
    }

    res.json({
      provider: provider.id,
      method: "hierarchical-force-directed",
      semanticPlan: {
        overallReasoning: semanticPlan.overallReasoning,
        beds: semanticPlan.beds.map((b) => ({
          bedId: b.bedId,
          plantCount: b.plants.reduce((sum, p) => sum + p.count, 0),
          strategy: b.strategy,
        })),
      },
      layouts,
    });
  } catch (err) {
    console.error("[HierarchicalPacker] Error:", err);
    res.status(500).json({
      error: err.message || "Hierarchical packer optimization failed.",
    });
  }
});

/**
 * Dev-only: Mount MCP SSE router
 *
 * - Controlled by env var `ENABLE_MCP_SSE` (defaults to enabled for local dev).
 * - The dev push endpoint inside the router is controlled by `ENABLE_MCP_PUSH`.
 *
 * NOTE: This is intended for local development only. In production, ensure these
 * endpoints are disabled or properly authenticated and rate-limited.
 */
/**
 * Dev-only: Mount MCP SSE router
 *
 * - Controlled by env var `ENABLE_MCP_SSE` (defaults to enabled for local dev).
 * - The dev push endpoint inside the router is controlled by `ENABLE_MCP_PUSH`.
 *
 * NOTE: This is intended for local development only. In production, ensure these
 * endpoints are disabled or properly authenticated and rate-limited.
 */
const enableMcpSse = process.env.ENABLE_MCP_SSE !== "false";
if (enableMcpSse) {
  const mcpRouter = createMcpSseRouter({
    // allow pushing via POST /mcp/push when ENABLE_MCP_PUSH is not explicitly "false"
    allowDevPush: process.env.ENABLE_MCP_PUSH !== "false",
  });
  // Mount at root so endpoints are available as /mcp/sse, /mcp/push, /mcp/status
  app.use(mcpRouter);
}

/**
 * Dev-only: well-known and MCP compatibility helpers
 *
 * ChatGPT and other MCP consumers probe a variety of discovery paths (e.g.
 * /.well-known/openid-configuration, /.well-known/oauth-authorization-server,
 * and variants under /mcp). Add small handlers that return a minimal, safe
 * discovery JSON and accept POST /mcp so probes succeed in dev. These handlers
 * are intentionally non-sensitive and should be protected/removed for production.
 */
const buildDiscovery = (req) => {
  // Prefer an explicit BASE_URL if set; otherwise synthesize from the incoming request.
  // Use x-forwarded-proto when present (ngrok and other proxies set this).
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
  const hostBase = process.env.BASE_URL || `${proto}://${host}`;

  return {
    issuer: hostBase,
    authorization_endpoint: `${hostBase}/oauth/{provider}/start`,
    token_endpoint: `${hostBase}/oauth/{provider}/token`,
    device_authorization_endpoint: `${hostBase}/oauth/{provider}/device/start`,
    revocation_endpoint: `${hostBase}/oauth/{provider}/disconnect`,
    // Helpful convenience fields for MCP-style clients
    device_poll_endpoint: `${hostBase}/oauth/{provider}/device/poll`,
    // Advertise the SSE entrypoint the MCP connector will use for streaming
    sse: { url: `${hostBase}/mcp/sse` },
  };
};

const wellKnownPaths = [
  "/.well-known/openid-configuration",
  "/mcp/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  "/mcp/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/mcp/.well-known/oauth-protected-resource",
];

for (const p of wellKnownPaths) {
  app.get(p, (req, res) => {
    res.json(buildDiscovery(req));
  });
}

// Some MCP probes POST to the base path. Accept POST /mcp with a safe acknowledgement.
// Dev-only: this endpoint is intentionally permissive for probe compatibility.
app.post("/mcp", express.json(), (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Dev-only: Accept POST / (some probes or health checks may POST to the root).
// Return a minimal, safe acknowledgement so external probes don't see 404s.
app.post("/", express.json(), (req, res) => {
  res.json({ ok: true, path: "/", timestamp: new Date().toISOString() });
});

// Dev-only: Gentle GET / root handler to acknowledge the base host.
// This is useful for basic health checks and for probes that expect a root response.
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Garden Craft MCP dev server (root)",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, "0.0.0.0", () => {
  const effectiveBase = process.env.BASE_URL || `http://localhost:${port}`;
  console.log(
    `Garden Craft AI server running on ${effectiveBase} (local port ${port})`,
  );
  console.log("MCP SSE enabled:", enableMcpSse ? "yes" : "no");
});
