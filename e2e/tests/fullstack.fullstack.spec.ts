import { test, expect, TEST_DATA } from "../fixtures";
import { Pool } from "pg";

/**
 * Fullstack E2E Tests
 * Covers: cross-package flows, real user journeys
 * Run: npx playwright test fullstack.fullstack.spec.ts --project=fullstack
 *
 * These tests simulate real user workflows across the entire application:
 * 1. User registers via API → browses listings → creates listing → receives offer
 * 2. Admin manages users created by registration flow
 * 3. Complete marketplace transaction lifecycle
 */

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password",
  database: process.env.POSTGRES_DB || "db",
});

async function seedAdminEmail() {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO admin_valid_emails (email) VALUES ($1) ON CONFLICT DO NOTHING`,
      [TEST_DATA.admin.email],
    );
  } finally {
    client.release();
  }
}

test.describe("Complete User Journey", () => {
  test("register → browse → create listing → receive offer → accept → receive", async ({
    apiUser,
    apiUser2,
    schoolId,
    categoryId,
  }) => {
    // Step 1: User1 registers
    const registerRes1 = await apiUser.post("/auth/register", {
      data: {
        email: "journey-seller@loop.test",
        password: "SecurePass123!",
        firstName: "Journey",
        lastName: "Seller",
        schoolIds: [schoolId],
      },
    });
    expect(registerRes1.ok()).toBeTruthy();
    const registerBody1 = await registerRes1.json();
    const user1Token = registerBody1.data.token;
    const user1Id = registerBody1.data.user.id;

    // Step 2: User2 registers
    const registerRes2 = await apiUser2.post("/auth/register", {
      data: {
        email: "journey-buyer@loop.test",
        password: "SecurePass123!",
        firstName: "Journey",
        lastName: "Buyer",
        schoolIds: [schoolId],
      },
    });
    expect(registerRes2.ok()).toBeTruthy();
    const registerBody2 = await registerRes2.json();
    const user2Token = registerBody2.data.token;
    const user2Id = registerBody2.data.user.id;

    // Step 3: User1 creates a listing
    const createRes = await apiUser.post("/listings", {
      headers: { Authorization: `Bearer ${user1Token}` },
      data: {
        title: "Journey Test Item",
        description: "Item for fullstack journey test",
        price: 100000,
        categoryId,
        productStatus: "new",
        mediaIds: [],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    const listingId = createBody.data.listing.id;

    // Step 4: User2 browses listings and finds User1's listing
    const browseRes = await apiUser.get("/listings");
    expect(browseRes.ok()).toBeTruthy();
    const browseBody = await browseRes.json();
    const foundListing = browseBody.data.listings.find((l: any) => l.id === listingId);
    expect(foundListing).toBeDefined();
    expect(foundListing.title).toBe("Journey Test Item");

    // Step 5: User2 gets listing details
    const detailsRes = await apiUser.get(`/listings/${listingId}`);
    expect(detailsRes.ok()).toBeTruthy();
    const detailsBody = await detailsRes.json();
    expect(detailsBody.data.listing.seller.id).toBe(user1Id);

    // Step 6: User2 makes an offer
    const offerRes = await apiUser.post(`/listings/${listingId}/offer`, {
      headers: { Authorization: `Bearer ${user2Token}` },
      data: { price: 85000 },
    });
    expect(offerRes.ok()).toBeTruthy();
    const offerBody = await offerRes.json();
    expect(offerBody.data.listing.listingStatus).toBe("offered");
    expect(offerBody.data.listing.buyerId).toBe(user2Id);

    // Step 7: User1 checks their listings and sees the offer
    const myListingsRes = await apiUser.get("/me/listings", {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    expect(myListingsRes.ok()).toBeTruthy();
    const myListingsBody = await myListingsRes.json();
    const offeredListing = myListingsBody.data.listings.find((l: any) => l.id === listingId);
    expect(offeredListing).toBeDefined();
    expect(offeredListing.listingStatus).toBe("offered");

    // Step 8: User1 accepts the offer
    const acceptRes = await apiUser.post(`/listings/${listingId}/offer/accept`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    expect(acceptRes.ok()).toBeTruthy();
    const acceptBody = await acceptRes.json();
    expect(acceptBody.success).toBe(true);

    // Step 9: User2 marks listing as received
    const receiveRes = await apiUser.post(`/listings/${listingId}/receive`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    expect(receiveRes.ok()).toBeTruthy();
    const receiveBody = await receiveRes.json();
    expect(receiveBody.success).toBe(true);

    // Step 10: Verify final state
    const finalRes = await apiUser.get(`/listings/${listingId}`);
    const finalBody = await finalRes.json();
    expect(finalBody.data.listing.listingStatus).toBe("received");
    expect(finalBody.data.listing.buyerId).toBe(user2Id);
  });
});

test.describe("Admin + User Cross-Flow", () => {
  test("admin can see and manage users created via registration", async ({
    apiUser,
    apiAdmin,
    schoolId,
  }) => {
    // User registers
    const registerRes = await apiUser.post("/auth/register", {
      data: {
        email: "admin-managed@loop.test",
        password: "SecurePass123!",
        firstName: "Admin",
        lastName: "Managed",
        schoolIds: [schoolId],
      },
    });
    expect(registerRes.ok()).toBeTruthy();
    const registerBody = await registerRes.json();
    const userId = registerBody.data.user.id;

    // Admin registers
    await seedAdminEmail();
    const adminRegisterRes = await apiAdmin.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });
    expect(adminRegisterRes.ok()).toBeTruthy();
    const adminBody = await adminRegisterRes.json();
    const adminToken = adminBody.data.token;

    // Admin searches for the user
    const searchRes = await apiAdmin.get("/admin/users?search=admin-managed", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(searchRes.ok()).toBeTruthy();
    const searchBody = await searchRes.json();
    const foundUser = searchBody.data.users.find((u: any) => u.id === userId);
    expect(foundUser).toBeDefined();
    expect(foundUser.email).toBe("admin-managed@loop.test");

    // Admin modifies user credits
    const creditsRes = await apiAdmin.post(`/admin/users/${userId}/credits`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        amount: 100000,
        positive: true,
      },
    });
    expect(creditsRes.ok()).toBeTruthy();
    const creditsBody = await creditsRes.json();
    expect(creditsBody.success).toBe(true);

    // Verify user has updated credits
    const meRes = await apiUser.get("/me", {
      headers: { Authorization: `Bearer ${registerBody.data.token}` },
    });
    const meBody = await meRes.json();
    expect(meBody.data.user.credits.balance).toBeGreaterThanOrEqual(100000);
  });
});

test.describe("Messaging Flow", () => {
  test("complete messaging conversation between two users", async ({
    apiUser,
    apiUser2,
    schoolId,
  }) => {
    // Register two users
    const res1 = await apiUser.post("/auth/register", {
      data: {
        email: "chat-user1@loop.test",
        password: "SecurePass123!",
        firstName: "Chat",
        lastName: "User1",
        schoolIds: [schoolId],
      },
    });
    const body1 = await res1.json();
    const user1Token = body1.data.token;
    const user1Id = body1.data.user.id;

    const res2 = await apiUser2.post("/auth/register", {
      data: {
        email: "chat-user2@loop.test",
        password: "SecurePass123!",
        firstName: "Chat",
        lastName: "User2",
        schoolIds: [schoolId],
      },
    });
    const body2 = await res2.json();
    const user2Token = body2.data.token;
    const user2Id = body2.data.user.id;

    // User1 sends message to User2
    const msg1Res = await apiUser.post(`/messages/${user2Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
      data: { text: "Hi! Is this item still available?" },
    });
    expect(msg1Res.ok()).toBeTruthy();

    // User2 sends message to User1
    const msg2Res = await apiUser.post(`/messages/${user1Id}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
      data: { text: "Yes, it is! Would you like to make an offer?" },
    });
    expect(msg2Res.ok()).toBeTruthy();

    // User1 sends another message
    const msg3Res = await apiUser.post(`/messages/${user2Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
      data: { text: "Great! I'll check it out." },
    });
    expect(msg3Res.ok()).toBeTruthy();

    // User2 retrieves conversation
    const convRes = await apiUser.get(`/messages/${user1Id}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    expect(convRes.ok()).toBeTruthy();
    const convBody = await convRes.json();
    expect(convBody.data.messages.length).toBe(3);

    // Verify message order (newest first)
    expect(convBody.data.messages[0].text).toBe("Great! I'll check it out.");
    expect(convBody.data.messages[1].text).toBe("Yes, it is! Would you like to make an offer?");
    expect(convBody.data.messages[2].text).toBe("Hi! Is this item still available?");

    // User2 checks unread chats
    const unreadRes = await apiUser.get("/me/messages/unread", {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    expect(unreadRes.ok()).toBeTruthy();
    const unreadBody = await unreadRes.json();
    expect(unreadBody.data.unreadChatsCount).toBeGreaterThanOrEqual(1);

    // User2 marks messages as read
    const readRes = await apiUser.post(`/messages/${user1Id}/read`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    expect(readRes.ok()).toBeTruthy();
  });
});

test.describe("Notifications Flow", () => {
  test("user receives notifications after listing actions", async ({
    apiUser,
    apiUser2,
    schoolId,
    categoryId,
  }) => {
    // Register two users
    const res1 = await apiUser.post("/auth/register", {
      data: {
        email: "notif-seller@loop.test",
        password: "SecurePass123!",
        firstName: "Notif",
        lastName: "Seller",
        schoolIds: [schoolId],
      },
    });
    const body1 = await res1.json();
    const sellerToken = body1.data.token;

    const res2 = await apiUser2.post("/auth/register", {
      data: {
        email: "notif-buyer@loop.test",
        password: "SecurePass123!",
        firstName: "Notif",
        lastName: "Buyer",
        schoolIds: [schoolId],
      },
    });
    const body2 = await res2.json();
    const buyerToken = body2.data.token;

    // Seller creates listing
    const createRes = await apiUser.post("/listings", {
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: {
        title: "Notification Test Item",
        price: 50000,
        categoryId,
        productStatus: "new",
        mediaIds: [],
      },
    });
    const createBody = await createRes.json();
    const listingId = createBody.data.listing.id;

    // Buyer makes offer (should trigger notification to seller)
    await apiUser.post(`/listings/${listingId}/offer`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: { price: 40000 },
    });

    // Seller checks notifications
    const notifRes = await apiUser.get("/me/notifications", {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(notifRes.ok()).toBeTruthy();
    const notifBody = await notifRes.json();
    expect(notifBody.data.notifications).toBeDefined();

    // Check unread count
    const unreadRes = await apiUser.get("/me/notifications/unread", {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(unreadRes.ok()).toBeTruthy();
    const unreadBody = await unreadRes.json();
    expect(unreadBody.data.unreadNotificationsCount).toBeGreaterThanOrEqual(1);

    // Seller marks all as read
    const readAllRes = await apiUser.post("/me/notifications/read-all", {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(readAllRes.ok()).toBeTruthy();

    // Verify unread count is now 0
    const unreadAfterRes = await apiUser.get("/me/notifications/unread", {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const unreadAfterBody = await unreadAfterRes.json();
    expect(unreadAfterBody.data.unreadNotificationsCount).toBe(0);
  });
});

test.describe("Wishlist Flow", () => {
  test("user can manage wishlist", async ({ apiUser, userToken, categoryId }) => {
    // Add to wishlist
    const addRes = await apiUser.post("/me/wishes", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        categoryId,
        comment: "I really want this!",
      },
    });
    expect(addRes.ok()).toBeTruthy();
    const addBody = await addRes.json();
    expect(addBody.success).toBe(true);
    expect(addBody.data.userWish.categoryId).toBe(categoryId);

    // Get wishlist
    const getRes = await apiUser.get("/me/wishes", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.data.userWishes.length).toBeGreaterThanOrEqual(1);

    // Update wishlist item
    const wishId = addBody.data.userWish.id;
    const updateRes = await apiUser.put(`/me/wishes/${wishId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        comment: "Updated comment",
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updateBody = await updateRes.json();
    expect(updateBody.data.userWish.comment).toBe("Updated comment");

    // Delete from wishlist
    const deleteRes = await apiUser.delete(`/me/wishes/${categoryId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(deleteRes.ok()).toBeTruthy();
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);

    // Verify deleted
    const getAfterRes = await apiUser.get("/me/wishes", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const getAfterBody = await getAfterRes.json();
    const stillThere = getAfterBody.data.userWishes.find((w: any) => w.categoryId === categoryId);
    expect(stillThere).toBeUndefined();
  });
});

test.describe("Missions Flow", () => {
  test("user can view missions", async ({ apiUser, userToken }) => {
    const res = await apiUser.get("/me/missions", {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userMissions).toBeDefined();
    expect(Array.isArray(body.data.userMissions)).toBe(true);
  });
});
