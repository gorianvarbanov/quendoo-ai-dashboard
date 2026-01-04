import dotenv from 'dotenv';

dotenv.config();

console.log('ADMIN_USERNAME:', process.env.ADMIN_USERNAME);
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD);
console.log('Password length:', process.env.ADMIN_PASSWORD?.length);
console.log('Password chars:', Array.from(process.env.ADMIN_PASSWORD || '').map((c, i) => `[${i}]="${c}" (${c.charCodeAt(0)})`).join(', '));
