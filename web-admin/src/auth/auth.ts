import { computed, readonly, ref } from "vue";

export type AppRole = "ADMIN" | "REVIEWER" | "AUTHOR" | "READER";
export type DemoUserId = "u-admin" | "u-author" | "u-reader";
export type AuthUser = { id: DemoUserId; displayName: string; roles: AppRole[]; departmentIds: string[]; teamIds: string[] };
export type AuthSession = { provider: "local" | "oidc"; user: AuthUser };
export interface AuthProvider {
  readonly mode: AuthSession["provider"];
  initialize(): Promise<AuthSession | null>;
  login(input: unknown): Promise<AuthSession>;
  logout(): Promise<void>;
  authorizationHeaders(): Promise<Record<string, string>>;
}
export interface AuthStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

export const DEMO_USERS: Readonly<Record<DemoUserId, AuthUser>> = {
  "u-admin": { id: "u-admin", displayName: "平台管理员", roles: ["ADMIN", "REVIEWER", "AUTHOR", "READER"], departmentIds: ["d-platform"], teamIds: ["t-search"] },
  "u-author": { id: "u-author", displayName: "技术作者", roles: ["AUTHOR", "READER"], departmentIds: ["d-platform"], teamIds: ["t-search"] },
  "u-reader": { id: "u-reader", displayName: "企业读者", roles: ["READER"], departmentIds: ["d-pay"], teamIds: ["t-pay"] },
};

const STORAGE_VERSION = 1;
const STORAGE_KEY = "enterprise-blog.admin.auth.v1";

function copyUser(user: AuthUser): AuthUser {
  return { ...user, roles: [...user.roles], departmentIds: [...user.departmentIds], teamIds: [...user.teamIds] };
}

function resolveUserId(input: unknown): DemoUserId | null {
  const candidate = typeof input === "string" ? input : typeof input === "object" && input !== null && "userId" in input ? (input as { userId?: unknown }).userId : null;
  return typeof candidate === "string" && candidate in DEMO_USERS ? candidate as DemoUserId : null;
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "登录状态已失效，请重新登录") { super(message); this.name = "AuthenticationRequiredError"; }
}

export class LocalDemoAuthProvider implements AuthProvider {
  readonly mode = "local" as const;
  private currentSession: AuthSession | null = null;
  constructor(private readonly storage: AuthStorage, private readonly storageKey: string, private readonly mockToken: string | undefined) {}

  async initialize(): Promise<AuthSession | null> {
    if (!this.mockToken?.trim()) { this.storage.removeItem(this.storageKey); this.currentSession = null; return null; }
    const stored = this.storage.getItem(this.storageKey);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as { version?: unknown; userId?: unknown };
      if (parsed.version !== STORAGE_VERSION) throw new Error("unsupported session version");
      const userId = resolveUserId(parsed.userId);
      if (!userId) throw new Error("unknown demo account");
      this.currentSession = { provider: "local", user: copyUser(DEMO_USERS[userId]) };
      return this.currentSession;
    } catch {
      this.storage.removeItem(this.storageKey);
      this.currentSession = null;
      return null;
    }
  }

  async login(input: unknown): Promise<AuthSession> {
    if (!this.mockToken?.trim()) throw new Error("本地演示登录未配置：请设置 VITE_MOCK_OIDC_TOKEN=local-dev-token");
    const userId = resolveUserId(input);
    if (!userId) throw new Error("请选择有效的演示账号");
    this.currentSession = { provider: "local", user: copyUser(DEMO_USERS[userId]) };
    this.storage.setItem(this.storageKey, JSON.stringify({ version: STORAGE_VERSION, userId }));
    return this.currentSession;
  }

  async logout(): Promise<void> { this.storage.removeItem(this.storageKey); this.currentSession = null; }
  async authorizationHeaders(): Promise<Record<string, string>> {
    if (!this.currentSession || !this.mockToken?.trim()) throw new AuthenticationRequiredError();
    const { user } = this.currentSession;
    return { "X-Mock-Token": this.mockToken, "X-Mock-User": user.id, "X-Mock-Roles": user.roles.join(","), "X-Mock-Departments": user.departmentIds.join(","), "X-Mock-Teams": user.teamIds.join(",") };
  }
}

class OidcAuthProviderPlaceholder implements AuthProvider {
  readonly mode = "oidc" as const;
  async initialize() { return null; }
  async login(): Promise<AuthSession> { throw new Error("企业 OIDC 尚未接入，请先配置 Issuer、Client ID 和回调地址"); }
  async logout() {}
  async authorizationHeaders(): Promise<Record<string, string>> { throw new AuthenticationRequiredError(); }
}

function createMemoryStorage(): AuthStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

function createAuthProvider(): AuthProvider {
  const localMode = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE !== "oidc";
  if (!localMode) return new OidcAuthProviderPlaceholder();
  const storage = typeof window === "undefined" ? createMemoryStorage() : window.localStorage;
  return new LocalDemoAuthProvider(storage, STORAGE_KEY, import.meta.env.VITE_MOCK_OIDC_TOKEN);
}

let provider = createAuthProvider();
const initialized = ref(false);
const session = ref<AuthSession | null>(null);
const authError = ref<string | null>(null);
let initialization: Promise<AuthSession | null> | null = null;
let unauthorizedHandler: (() => Promise<void> | void) | null = null;
let unauthorizedHandling: Promise<void> | null = null;

export async function initializeAuth(): Promise<AuthSession | null> {
  if (!initialization) initialization = provider.initialize().then((restored) => { session.value = restored; return restored; }).catch((reason: unknown) => { authError.value = reason instanceof Error ? reason.message : "认证初始化失败"; session.value = null; return null; }).finally(() => { initialized.value = true; });
  return initialization;
}

export async function login(userId: DemoUserId): Promise<AuthSession> {
  authError.value = null;
  try { const next = await provider.login({ userId }); session.value = next; return next; }
  catch (reason) { authError.value = reason instanceof Error ? reason.message : "登录失败"; throw reason; }
}

export async function logout(): Promise<void> { await provider.logout(); session.value = null; authError.value = null; }
export function authorizationHeaders() { return provider.authorizationHeaders(); }
export function configureUnauthorizedHandler(handler: () => Promise<void> | void) { unauthorizedHandler = handler; }
export async function handleUnauthorized(): Promise<void> {
  if (!unauthorizedHandling) unauthorizedHandling = (async () => { await logout(); await unauthorizedHandler?.(); })().finally(() => { unauthorizedHandling = null; });
  await unauthorizedHandling;
}

export function useAuth() {
  return { initialized: readonly(initialized), session: readonly(session), user: computed(() => session.value?.user ?? null), isAuthenticated: computed(() => session.value !== null), mode: computed(() => provider.mode), error: readonly(authError), hasRole: (role: AppRole) => session.value?.user.roles.includes(role) ?? false, login, logout };
}

export const authTesting = {
  replaceProvider(next: AuthProvider) { provider = next; initialization = null; initialized.value = false; session.value = null; authError.value = null; unauthorizedHandler = null; unauthorizedHandling = null; },
};
