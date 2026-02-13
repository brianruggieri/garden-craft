import { useEffect, useState } from "react";
import { AIProviderId } from "../shared/types";
import { withServerUrl } from "../services/serverUrl";

type ProviderEntry = { id: string; name: string; supportsOAuth?: boolean };

type OAuthStatus = {
  connected: boolean;
  expiresAt: number | null;
} | null;

type DeviceFlowStartResult = {
  key: string;
  userCode: string | null;
  verificationUri: string | null;
  verificationUriComplete: string | null;
} | null;

export const useAIProviders = () => {
  const [aiProvider, setAiProvider] = useState<AIProviderId>("local");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiProviders, setAiProviders] = useState<ProviderEntry[]>([]);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>(null);
  const [oauthChecking, setOauthChecking] = useState(false);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await fetch(withServerUrl("/api/providers"));
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.providers)) {
          setAiProviders(data.providers);
        }
      } catch (err) {
        console.warn("Failed to load providers", err);
      }
    };

    loadProviders();
  }, []);

  useEffect(() => {
    let isActive = true;

    const checkOAuth = async () => {
      setOauthChecking(true);
      try {
        const res = await fetch(withServerUrl(`/oauth/${aiProvider}/connected`));
        if (!res.ok) {
          if (isActive) setOauthStatus(null);
          return;
        }
        const data = await res.json();
        if (isActive) {
          setOauthStatus({
            connected: Boolean(data?.connected),
            expiresAt: typeof data?.expiresAt === "number" ? data.expiresAt : null,
          });
        }
      } catch (err) {
        if (isActive) setOauthStatus(null);
      } finally {
        if (isActive) setOauthChecking(false);
      }
    };

    checkOAuth();

    return () => {
      isActive = false;
    };
  }, [aiProvider]);

  const handleTriggerOAuth = (provider: string) => {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = withServerUrl(
      `/oauth/${provider}/start?redirect=${redirect}`,
    );
  };

  // Start a device-code flow for headless/dev environments.
  // Returns minimal verification info or null on failure.
  const handleStartDeviceFlow = async (
    provider: string,
  ): Promise<DeviceFlowStartResult> => {
    if (!provider) return null;
    try {
      const res = await fetch(withServerUrl(`/oauth/${provider}/device/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      if (!body) return null;
      return {
        key: body.key,
        userCode: body.userCode || null,
        verificationUri:
          body.verificationUri || body.verificationUriComplete || null,
        verificationUriComplete: body.verificationUriComplete || null,
      };
    } catch (err) {
      console.warn("Device start failed", err);
      return null;
    }
  };

  // Poll device flow status once using the provided key.
  // Returns the provider response (status/payload) or null on error.
  const handlePollDeviceFlow = async (provider: string, key: string) => {
    if (!provider || !key) return null;
    try {
      const res = await fetch(
        withServerUrl(
          `/oauth/${provider}/device/poll?key=${encodeURIComponent(key)}`,
        ),
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      const payload = await res.json().catch(() => null);
      return payload;
    } catch (err) {
      console.warn("Device poll failed", err);
      return null;
    }
  };

  // Disconnect provider by clearing the in-memory token on the server (dev-only).
  // Returns true if a stored connection was removed.
  const handleDisconnectProvider = async (provider: string) => {
    if (!provider) return false;
    try {
      const res = await fetch(withServerUrl(`/oauth/${provider}/disconnect`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return false;
      const body = await res.json().catch(() => null);
      return Boolean(body?.disconnected);
    } catch (err) {
      console.warn("Disconnect failed", err);
      return false;
    }
  };

  return {
    aiProvider,
    aiModel,
    aiApiKey,
    aiProviders,
    setAiProvider,
    setAiModel,
    setAiApiKey,
    oauthStatus,
    oauthChecking,
    handleTriggerOAuth,
    handleStartDeviceFlow,
    handlePollDeviceFlow,
    handleDisconnectProvider,
  };
};
