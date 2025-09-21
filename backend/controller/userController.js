import * as User from '../models/user.js'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer';
import 'dotenv/config';



export const getUsers = async (req,res) =>{
    try{
        const users = await User.getUsers();
        res.send({'users': users})
    }
    catch(e){
        res.send({'error':e})
    }
}


export const registerSurveyor = async (req, res) => {
    try {
        // Check if email already exists
        const user = await User.findUserByEmail(req.body.email);
        if (user) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        console.log(req.body);

        // Hash password
        const hashedPassword = await argon2.hash(req.body.password);

        const surveyor = {
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            role: req.body.role
        };

        // Save surveyor
        const result = await User.addSurveyor(surveyor);

        // Send email with credentials
        await sendSurveyorCredentialsEmail(
            req.body.email,
            req.body.name,
            req.body.email, // username is email
            req.body.password // plain text password
        );

        res.send({
            message: 'Surveyor creation successful. Credentials sent via email.',
            result: result
        });

    } catch (e) {
        console.log(e);
        res.status(500).send({ error: e.message || e });
    }
};

// Function to send email
async function sendSurveyorCredentialsEmail(toEmail, name, username, password) {
    // Configure transporter
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", // or your SMTP host
        port: 465,
        secure: true, // true for 465, false for 587
        auth: {
            user: process.env.SMTP_USER, // Your email
            pass: process.env.SMTP_PASS  // Your email password / app password
        }
    });

    // Send mail
    await transporter.sendMail({
        from: `"Survey App" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: "Your Surveyor Account Credentials",
        html: `
            <h3>Welcome, ${name}!</h3>
            <p>Your surveyor account has been created successfully.</p>
            <p><strong>Email:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p>Please log in and change your password after your first login.</p>
        `
    });
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findUserByEmail(normalizedEmail);
    // Use 401 for both “not found” and bad password (don’t leak user existence)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await argon2.verify(user.password, password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!process.env.JWT_SECRET) {
      // Don’t continue if secret missing
      return res.status(500).json({ error: 'JWT misconfigured on server' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // 'admin' | 'surveyor'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '2h',
      issuer: 'your-app',         // optional, but good practice
      audience: 'your-mobile-app' // optional
    });

    // If you want cookie for web later:
    // res.cookie('token', token, {
    //   httpOnly: true,
    //   sameSite: 'lax',
    //   secure: process.env.NODE_ENV === 'production',
    //   maxAge: 2 * 60 * 60 * 1000
    // });

    return res.status(200).json({
      message: 'Login Successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// PUT /user/:id
export const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await User.findUserById(id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { name, email, role, password } = req.body || {};

    const updateFields = {};
    if (name !== undefined) updateFields.name = String(name).trim();
    if (email !== undefined) updateFields.email = String(email).trim().toLowerCase();
    if (role !== undefined) updateFields.role = role; // validator ensures 'admin' or 'surveyor'

    if (password) {
      // only hash when provided
      updateFields.password = await argon2.hash(password);
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    try {
      const updated = await User.updateUserById(id, updateFields);
      return res.json({ user: updated });
    } catch (e) {
      // Unique email
      if (e?.code === '23505') {
        return res.status(409).json({ error: 'Email already in use' });
      }
      throw e;
    }
  } catch (e) {
    console.error('updateUser error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /user/:id
export const deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    // Optional safety: prevent deleting yourself
    if (req.user && Number(req.user.id) === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const deleted = await User.deleteUserById(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });

    return res.status(204).send(); // or res.json({ message: 'Deleted' })
  } catch (e) {
    console.error('deleteUser error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};










function sixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000)); // "123456"
}

function requireEnv(keys) {
  for (const k of keys) {
    if (!process.env[k] || String(process.env[k]).trim() === '') {
      throw new Error(`Missing env: ${k}`);
    }
  }
}

async function makeMailer() {
  requireEnv(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE ?? 'true') !== 'false', // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendResetCodeEmail(toEmail, code) {
  const t = await makeMailer();
  await t.sendMail({
    from: `"Survey App" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your password reset code',
    html: `
      <p>Use this code to reset your password:</p>
      <h2 style="letter-spacing:3px">${code}</h2>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

/** POST /auth/forgot-password  { email } */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const normalized = email.trim().toLowerCase();
    const user = await User.findUserByEmail(normalized);

    if (!user) return res.json({ message: 'If that email exists, we sent a code.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await User.updateUserById(user.id, {
      password_reset_code_hash: codeHash,
      password_reset_expires_at: expires,
    });

    await sendResetCodeEmail(normalized, code);

    console.log('[FORGOT]', { email: normalized, userId: user.id, expires: expires.toISOString() }); // TEMP

    return res.json({ message: 'If that email exists, we sent a code.' });
  } catch (e) {
    console.error('forgotPassword error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

/** POST /auth/reset-password  { email, code, password } */
export const resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body || {};
    if (!email || !code || !password)
      return res.status(400).json({ error: 'email, code, password are required' });

    const normalized = email.trim().toLowerCase();
    const user = await User.findUserByEmail(normalized);
    if (!user) return res.status(400).json({ error: 'Invalid code or expired' });

    if (!user.password_reset_code_hash || !user.password_reset_expires_at)
      return res.status(400).json({ error: 'Invalid code or expired' });

    if (new Date(user.password_reset_expires_at) < new Date())
      return res.status(400).json({ error: 'Code expired' });

    const ok = await argon2.verify(user.password_reset_code_hash, String(code).trim());
    if (!ok) return res.status(400).json({ error: 'Invalid code' });

    const newHash = await argon2.hash(password, { type: argon2.argon2id });

    await User.updateUserById(user.id, {
      password: newHash,
      password_reset_code_hash: null,
      password_reset_expires_at: null,
    });

    return res.json({ message: 'Password updated. You can now log in.' });
  } catch (e) {
    console.error('resetPassword error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};




