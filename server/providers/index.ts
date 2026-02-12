import geminiProvider from "./geminiProvider";
import openaiProvider from "./openaiProvider";
import anthropicProvider from "./anthropicProvider";
import localProvider from "./localProvider";
import type { GardenBed, Vegetable } from "../../shared/types";

export interface ProviderAuth {
  apiKey?: string;
  oauthAccessToken?: string;
}

export interface GenerateLayoutOptions {
  beds: GardenBed[];
  seeds: Vegetable[];
  sunOrientation: string;
  style?: Record<string, any>;
  optimizationGoals?: string[];
  auth?: ProviderAuth;
  model?: string;
  customPrompt?: {
    system: string;
    prompt: string;
    schema?: Record<string, any>;
  };
  config?: Record<string, any>;
}

export interface Provider {
  id: string;
  name: string;
  supportsOAuth: boolean;
  generateLayout(options: GenerateLayoutOptions): Promise<any>;
  createClient?: (auth: ProviderAuth) => any;
}

export interface ProviderInfo {
  id: string;
  name: string;
  supportsOAuth: boolean;
}

const initialProviders: Provider[] = [
  geminiProvider,
  openaiProvider,
  anthropicProvider,
  localProvider,
].map((p) => {
  // some module systems expose the actual default export on `.default`
  const provider = (p as any)?.default ?? p;
  return provider as Provider;
});

const providers = new Map<string, Provider>(
  initialProviders.map(
    (provider) =>
      [String(provider.id).toLowerCase(), provider] as [string, Provider],
  ),
);

export function getProvider(id: string | null | undefined): Provider | null {
  if (!id) return null;
  return providers.get(String(id).toLowerCase()) || null;
}

export function listProviders(): ProviderInfo[] {
  return Array.from(providers.values()).map((provider) => ({
    id: provider.id,
    name: provider.name,
    supportsOAuth: Boolean(provider.supportsOAuth),
  }));
}

export function registerProvider(provider: Provider): void {
  if (!provider || !provider.id) {
    throw new Error("Provider must include an id.");
  }
  providers.set(String(provider.id).toLowerCase(), provider);
}

export const providerRegistry = providers;

export default {
  getProvider,
  listProviders,
  registerProvider,
  providerRegistry,
};
