// db.js
import pgPromise from 'pg-promise';

// Initialize pg-promise
export  const pgp = pgPromise({ /* options if needed */ });

// Connect to DB using a connection string
const db = pgp('postgres://postgres:1234@localhost:5432/survey');



export default db;