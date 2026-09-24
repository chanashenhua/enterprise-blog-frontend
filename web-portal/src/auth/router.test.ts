import { beforeEach, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "@/router";
import { authTesting, initializeAuth, LocalDemoAuthProvider, login, logout } from "./auth";
beforeEach(async () => {
  const values = new Map<string, string>();
  authTesting.replaceProvider(new LocalDemoAuthProvider({
    getItem: k => values.get(k) ?? null, setItem: (k,v) => {values.set(k,v);}, removeItem: k => {values.delete(k);},
  }, "test", "token"));
  await initializeAuth();
});
it("redirects anonymous users, preserves the destination and guards after logout", async () => {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/articles/new");
  expect(router.currentRoute.value.name).toBe("login");
  expect(router.currentRoute.value.query.redirect).toBe("/articles/new");
  await login("u-admin");
  await router.push("/articles/new");
  expect(router.currentRoute.value.path).toBe("/articles/new");
  await logout();
  await router.push("/");
  expect(router.currentRoute.value.name).toBe("login");
});
it.each(["u-reader","u-author"])("applies the role boundary for %s", async id => {
  const router = createAppRouter(createMemoryHistory());
  await login(id);
  await router.push("/articles/new");
  expect(router.currentRoute.value.path).toBe(id === "u-reader" ? "/forbidden" : "/articles/new");
});
it("sends signed-in users visiting login to their landing page", async () => {
  const router = createAppRouter(createMemoryHistory());
  await login("u-admin");
  await router.push("/login?redirect=/articles");
  expect(router.currentRoute.value.path).toBe("/");
});

