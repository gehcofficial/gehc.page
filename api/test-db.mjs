import { getPrisma, isDbConfigured, testConnection } from '../server/db.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing db module...');
    console.log('isDbConfigured:', isDbConfigured());
    
    const prisma = getPrisma();
    console.log('getPrisma:', prisma ? 'success' : 'null');
    
    if (prisma) {
      const connected = await testConnection();
      console.log('testConnection:', connected);
      return res.json({ ok: true, dbConfigured: isDbConfigured(), connected });
    }
    
    return res.json({ ok: true, dbConfigured: isDbConfigured(), connected: false });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}