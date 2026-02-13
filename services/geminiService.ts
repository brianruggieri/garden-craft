import {
  BedLayout,
  GardenBed,
  SunOrientation,
  Vegetable,
} from "../shared/types";
import { getServerUrl, withServerUrl } from "./serverUrl";

type AIProviderId = "gemini" | "openai" | "anthropic" | "local";

interface OptimizationRequest {
  provider?: AIProviderId;
  beds: GardenBed[];
  seeds: Vegetable[];
  sunOrientation: SunOrientation;
  style?: Record<string, unknown>;
  optimizationGoals?: string[];
  auth?: {
    apiKey?: string;
    oauthAccessToken?: string;
  };
  model?: string;
}

interface OptimizationResponse {
  provider: AIProviderId;
  layouts: BedLayout[];
}

async function postOptimize(
  serverUrl: string,
  payload: OptimizationRequest,
): Promise<OptimizationResponse> {
  const response = await fetch(withServerUrl("/api/optimize", serverUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Optimization request failed (${response.status}): ${text || "Unknown error"}`,
    );
  }

  return response.json();
}

/**
 * Server-backed AI layout generator.
 * This client never instantiates provider SDKs in the browser.
 */
export async function generateGardenLayout(
  beds: GardenBed[],
  seeds: Vegetable[],
  sunOrientation: SunOrientation,
  options: {
    provider?: AIProviderId;
    style?: Record<string, unknown>;
    optimizationGoals?: string[];
    auth?: { apiKey?: string; oauthAccessToken?: string };
    model?: string;
    serverUrl?: string;
  } = {},
): Promise<BedLayout[]> {
  const serverUrl = options.serverUrl || getServerUrl();

  const result = await postOptimize(serverUrl, {
    provider: options.provider || "local",
    beds,
    seeds,
    sunOrientation,
    style: options.style,
    optimizationGoals: options.optimizationGoals,
    auth: options.auth,
    model: options.model,
  });

  return result.layouts || [];
}
