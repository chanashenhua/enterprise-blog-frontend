import { computed, readonly, ref } from "vue";

export type AppRole = "ADMIN" | "REVIEWER" | "AUTHOR" | "READER";
export type DemoUserId = "u-admin" | "u-author" | "u-reader";
export type AuthUser = { id: string; displayName: string; roles: AppRole[]; departmentIds: string[]; teamIds: string[] };
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
  return typeof candidate === "string" && Object.prototype.hasOwnProperty.call(DEMO_USERS, candidate) ? candidate as DemoUserId : null;
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
    this.currentSession = null;
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
    this.storage.setItem(this.storageKey, JSON.stringify({ version: STORAGE_VERSION, userId }));
    this.currentSession = { provider: "local", user: copyUser(DEMO_USERS[userId]) };
    return this.currentSession;
  }

  async logout(): Promise<void> {
    this.currentSession = null;
    this.storage.removeItem(this.storageKey);
  }
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
  const localMode = import.meta.env.DEV && (!import.meta.env.VITE_AUTH_MODE || import.meta.env.VITE_AUTH_MODE === "local");
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
let generation = 0;
let requests = new AbortController();

function invalidateRequests() {
  generation++;
  requests.abort();
  requests = new AbortController();
}

export async function initializeAuth(): Promise<AuthSession | null> {
  if (initialized.value) return session.value;
  if (!initialization) {
    const started = generation;
    initialization = provider.initialize().then((restored) => {
      if (started === generation) session.value = restored;
      return session.value;
    }).catch((reason: unknown) => {
      if (started === generation) {
        authError.value = reason instanceof Error ? reason.message : "认证初始化失败";
        session.value = null;
      }
      return session.value;
    }).finally(() => { initialized.value = true; });
  }
  return initialization;
}

export async function login(input: unknown): Promise<AuthSession> {
  await initializeAuth();
  if (unauthorizedHandling) await unauthorizedHandling;
  authError.value = null;
  invalidateRequests();
  const started = generation;
  try {
    const next = await provider.login(input);
    if (started !== generation) throw new AuthenticationRequiredError();
    session.value = next;
    return next;
  } catch (reason) {
    if (started === generation) authError.value = reason instanceof Error ? reason.message : "登录失败";
    throw reason;
  }
}

export async function logout(): Promise<void> {
  invalidateRequests();
  session.value = null;
  authError.value = null;
  await provider.logout();
}

export async function authorizationHeaders() {
  if (!session.value) throw new AuthenticationRequiredError();
  return provider.authorizationHeaders();
}

// A response belongs to the session that started it, even if logout/login happens while awaiting it.
export async function authorizationContext() {
  const started = generation;
  const signal = requests.signal;
  const assertCurrent = () => {
    if (started !== generation || !session.value || signal.aborted) {
      throw new AuthenticationRequiredError("请求所属的登录会话已结束");
    }
  };
  assertCurrent();
  const headers = await authorizationHeaders();
  assertCurrent();
  return { headers, signal, generation: started, assertCurrent };
}

export function configureUnauthorizedHandler(handler: () => Promise<void> | void) {
  unauthorizedHandler = handler;
}

export async function handleUnauthorized(requestGeneration = generation): Promise<void> {
  if (requestGeneration !== generation || !session.value) return;
  if (!unauthorizedHandling) {
    unauthorizedHandling = (async () => {
      await logout();
      await unauthorizedHandler?.();
    })().finally(() => { unauthorizedHandling = null; });
  }
  await unauthorizedHandling;
}

export function useAuth() {
  return {
    initialized: readonly(initialized),
    session: readonly(session),
    user: computed(() => session.value?.user ?? null),
    isAuthenticated: computed(() => session.value !== null),
    canWrite: computed(() => !!session.value?.user.roles.some(role => role === "ADMIN" || role === "AUTHOR")),
    mode: computed(() => provider.mode),
    error: readonly(authError),
    hasRole: (role: AppRole) => session.value?.user.roles.includes(role) ?? false,
    login,
    logout,
  };
}

export const authTesting = {
  replaceProvider(next: AuthProvider) {
    invalidateRequests();
    provider = next;
    initialization = null;
    initialized.value = false;
    session.value = null;
    authError.value = null;
    unauthorizedHandler = null;
    unauthorizedHandling = null;
  },
};
