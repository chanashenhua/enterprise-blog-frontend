import { describe, expect, it } from "vitest";
import { DEMO_USERS, LocalDemoAuthProvider } from "./auth";

function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }; }

describe("admin local authentication", () => {
  it("authenticates all accounts while only the admin owns ADMIN", async () => {
    for (const userId of ["u-admin", "u-author", "u-reader"] as const) {
      const session = await new LocalDemoAuthProvider(storage(), "session", "token").login(userId);
      expect(session.user).toEqual(DEMO_USERS[userId]);
      expect(session.user.roles.includes("ADMIN")).toBe(userId === "u-admin");
    }
  });
});
