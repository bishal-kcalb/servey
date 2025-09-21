import db from '../db_connection/connection.js';

export async function getOrCreateProfile(userId) {
  // return user + profile (create profile row if missing)
  const user = await db.one('SELECT id, name, email, role FROM users WHERE id=$1', [userId]);

  const profile = await db.oneOrNone(
    'SELECT id, user_id, phone, address, avatar_url, created_at, updated_at FROM profiles WHERE user_id=$1',
    [userId]
  );

  if (profile) return { user, profile };

  const created = await db.one(
    `INSERT INTO profiles (user_id) VALUES ($1)
     RETURNING id, user_id, phone, address, avatar_url, created_at, updated_at`,
    [userId]
  );
  return { user, profile: created };
}

export async function updateProfile(userId, { phone, address, avatar_url, name }) {
  // update users.name if provided
  if (typeof name === 'string' && name.trim()) {
    await db.none('UPDATE users SET name=$1 WHERE id=$2', [name.trim(), userId]);
  }

  const exists = await db.oneOrNone('SELECT id FROM profiles WHERE user_id=$1', [userId]);
  if (exists) {
    const updated = await db.one(
      `UPDATE profiles
       SET phone=$1, address=$2, avatar_url=COALESCE($3, avatar_url), updated_at=NOW()
       WHERE user_id=$4
       RETURNING id, user_id, phone, address, avatar_url, created_at, updated_at`,
      [phone || null, address || null, avatar_url || null, userId]
    );
    return updated;
  } else {
    const created = await db.one(
      `INSERT INTO profiles (user_id, phone, address, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, phone, address, avatar_url, created_at, updated_at`,
      [userId, phone || null, address || null, avatar_url || null]
    );
    return created;
  }
}
