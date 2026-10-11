import {
  getDb,
  hasAdminAccount,
  createInitialAdmin,
  createAdminSession,
  hashPassword,
} from "../src/lib/db";

export const TEST_ADMIN_USER = "testadmin";
export const TEST_ADMIN_PASS = "TestAdminPass123!";

export function getTestAdminCookie(): string {
  const db = getDb();

  if (!hasAdminAccount()) {
    createInitialAdmin(TEST_ADMIN_USER, TEST_ADMIN_PASS);
  }

  let user = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(TEST_ADMIN_USER) as { id: string } | undefined;
  if (!user) {
    const { hash, salt } = hashPassword(TEST_ADMIN_PASS);
    const userId = `admin_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, TEST_ADMIN_USER, hash, salt, Date.now(), Date.now());
    user = { id: userId };
  }

  const session = createAdminSession(user.id);
  return `admin_session=${session.token}`;
}
