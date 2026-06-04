import { test, expect } from "../fixtures";

test.describe("POST /messages/:userId", () => {
  test("sends a message to another user", async ({ apiUser, userToken, user2 }) => {
    const res = await apiUser.post(`/messages/${user2.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { text: "Hello from E2E test!" },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.message.text).toBe("Hello from E2E test!");
  });

  test("rejects sending message without auth", async ({ apiUser, user2 }) => {
    const res = await apiUser.post(`/messages/${user2.id}`, {
      data: { text: "Unauthorized message" },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects sending empty message", async ({ apiUser, userToken, user2 }) => {
    const res = await apiUser.post(`/messages/${user2.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { text: "" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("GET /messages/:userId", () => {
  test("retrieves conversation", async ({ apiUser, userToken, user2 }) => {
    await apiUser.post(`/messages/${user2.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { text: "Conversation starter" },
    });

    const res = await apiUser.get(`/messages/${user2.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.messages.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("GET /me/messages", () => {
  test("returns list of chats", async ({ apiUser, userToken, user2 }) => {
    await apiUser.post(`/messages/${user2.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { text: "Chat test" },
    });

    const res = await apiUser.get("/me/messages", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.chats).toBeDefined();
  });
});

test.describe("GET /me/messages/unread", () => {
  test("returns unread count", async ({ apiUser, userToken }) => {
    const res = await apiUser.get("/me/messages/unread", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.data.unreadChatsCount).toBe("number");
  });
});
