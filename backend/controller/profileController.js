import argon2 from 'argon2'
import db from '../db_connection/connection.js';
import { getOrCreateProfile, updateProfile } from '../models/profileModel.js';

export async function getMyProfile(req, res) {
  try {
    const userId = req.user.id; // assume auth middleware sets req.user
    const { user, profile } = await getOrCreateProfile(userId);
    res.json({ user, profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}

export async function putMyProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, phone, address, avatar_url } = req.body || {};
    const updated = await updateProfile(userId, { name, phone, address, avatar_url });
    const user = await db.one('SELECT id, name, email, role FROM users WHERE id=$1', [userId]);
    res.json({ user, profile: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changeMyPassword(req, res) {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    const user = await db.one('SELECT id, password FROM users WHERE id=$1', [userId]);
    // const ok = await bcrypt.compare(current_password, user.password);
    const ok = await argon2.verify(current_password, user.password);

    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.none('UPDATE users SET password=$1 WHERE id=$2', [hash, userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to change password' });
  }
}
