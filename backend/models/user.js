import db from "../db_connection/connection.js";

// export const getUsers = async () => {
//   try {
//     const users = db.any(`SELECT id,email,name,role FROM users`);
//     return users;
//   }
//   catch (e) {
//     console.log(e)
//   }
// }

// export const findUserById = async (id) => {
//   return db.oneOrNone(
//     `SELECT id, name, email, password, role, created_at
//      FROM users WHERE id = $1`,
//     [id]
//   );
// };

// export const addSurveyor = async (surveyor) => {
//   try {
//     return db.one(
//       `INSERT INTO users (name, email, password, role)
//             VALUES ($1, $2, $3, $4)
//             RETURNING id, name, email, role, created_at
//             `,
//       [surveyor.name, surveyor.email, surveyor.password, surveyor.role]

//     )
//   }
//   catch (e) {
//     console.log(e)
//   }
// }

// export const findUserByEmail = async (email) => {
//   return db.oneOrNone(`SELECT * FROM users WHERE email = $1`, [email])
// }



// export const updateUserById = async (id, fields) => {
//   // fields can include: name, email, role, password (already hashed coming from controller)
//   const allowed = ['name', 'email', 'role', 'password'];
//   const keys = Object.keys(fields).filter(k => allowed.includes(k) && fields[k] !== undefined);

//   if (keys.length === 0) return null;

//   const sets = [];
//   const values = [];
//   let i = 1;

//   for (const k of keys) {
//     sets.push(`${k} = $${i++}`);
//     values.push(fields[k]);
//   }
//   values.push(id);

//   const q = `
//     UPDATE users
//     SET ${sets.join(', ')}
//     WHERE id = $${i}
//     RETURNING id, name, email, role, created_at
//   `;

//   return db.one(q, values);
// };

// export const deleteUserById = async (id) => {
//   return db.oneOrNone(
//     `DELETE FROM users WHERE id = $1 RETURNING id`,
//     [id]
//   );
// }


export async function findUserByEmail(email) {
  return db.oneOrNone(
    `
    SELECT
      id,
      name,
      email,
      password,
      role,
      password_reset_code_hash,
      password_reset_expires_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );
}

/** Return a user by id (also include reset fields for admin/debug) */
export async function findUserById(id) {
  return db.oneOrNone(
    `
    SELECT
      id,
      name,
      email,
      password,
      role,
      password_reset_code_hash,
      password_reset_expires_at
    FROM users
    WHERE id = $1
    `,
    [id]
  );
}

/** List users (you can trim columns if you want) */
export async function getUsers() {
  return db.any(
    `
    SELECT id, name, email, role,
           created_at, updated_at
    FROM users
    ORDER BY id DESC
    `
  );
}

/** Insert a surveyor (or any user) */
export async function addSurveyor({ name, email, password, role = 'surveyor' }) {
  return db.one(
    `
    INSERT INTO users (name, email, password, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role
    `,
    [name, email, password, role]
  );
}

/**
 * Generic update — allows updating password & reset-related fields.
 * Only whitelisted columns are permitted.
 */
export async function updateUserById(id, fields) {
  const allowed = [
    'name',
    'email',
    'role',
    'password',
    'password_reset_code_hash',
    'password_reset_expires_at',
  ];

  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) {
    // nothing to update; return the current record instead of failing
    return findUserById(id);
  }

  // Build a dynamic UPDATE SET clause, $1..$N safely parameterized
  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map(k => fields[k]);

  const sql = `
    UPDATE users
       SET ${sets.join(', ')},
           updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, email, role,
               password_reset_code_hash, password_reset_expires_at
  `;

  return db.one(sql, [id, ...values]);
}

/** Delete */
export async function deleteUserById(id) {
  const r = await db.result('DELETE FROM users WHERE id = $1', [id], a => a.rowCount);
  return r > 0;
}