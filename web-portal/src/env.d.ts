/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_MODE?: "local" | "oidc";
  readonly VITE_MOCK_OIDC_TOKEN?: string;
  readonly VITE_ADMIN_URL?: string;
}
