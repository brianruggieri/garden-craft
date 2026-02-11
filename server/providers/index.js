import geminiProvider from "./geminiProvider.js";
import openaiProvider from "./openaiProvider.js";
import anthropicProvider from "./anthropicProvider.js";
import localProvider from "./localProvider.js";

const providers = new Map(
  [geminiProvider, openaiProvider, anthropicProvider, localProvider].map(
    (provider) => [provider.id, provider],
  ),
);

export function getProvider(id) {
  if (!id) return null;
  return providers.get(String(id).toLowerCase()) || null;
}

export function listProviders() {
  return Array.from(providers.values()).map((provider) => ({
    id: provider.id,
    name: provider.name,
    supportsOAuth: Boolean(provider.supportsOAuth),
  }));
}

export function registerProvider(provider) {
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
