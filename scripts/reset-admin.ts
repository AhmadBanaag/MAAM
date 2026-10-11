import Database from "better-sqlite3";
import path from "node:path";
import crypto from "node:crypto";

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

const dbPath = path.join(process.cwd(), "data", "quiz-battle.db");
const db = new Database(dbPath);

const args = process.argv.slice(2);
const newUsername = args[0];
const newPassword = args[1];

if (newUsername && newPassword) {
  if (newPassword.length < 8) {
    console.error("❌ Password must be at least 8 characters long.");
    process.exit(1);
  }

  // Clear existing admin users and sessions
  db.prepare("DELETE FROM admin_sessions").run();
  db.prepare("DELETE FROM admin_users").run();
  db.prepare("DELETE FROM admin_login_attempts").run();

  const { hash, salt } = hashPassword(newPassword);
  const userId = `admin_${crypto.randomBytes(6).toString("hex")}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, newUsername.trim(), hash, salt, now, now);

  console.log(`\n✅ Admin account updated successfully!`);
  console.log(`   Username: ${newUsername.trim()}`);
  console.log(`   Password: ${newPassword}`);
  console.log(`   Login URL: http://localhost:3000/admin/login\n`);
} else {
  // Clear all admin accounts so user can use the Setup screen in UI
  db.prepare("DELETE FROM admin_sessions").run();
  db.prepare("DELETE FROM admin_users").run();
  db.prepare("DELETE FROM admin_login_attempts").run();

  console.log(`\n🧹 All admin accounts and sessions have been cleared.`);
  console.log(`👉 Open http://localhost:3000/admin/login in your browser to create your own initial administrator username and password!\n`);
}
