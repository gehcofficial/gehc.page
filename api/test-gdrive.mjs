import { getDriveMode, listFolders, listFiles, getFileStream, testConnection as testDrive, getFolderChain, listFolderTree } from '../server/gdrive.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing gdrive module...');
    console.log('getDriveMode:', getDriveMode());
    return res.json({ ok: true, message: 'GDrive module works', driveMode: getDriveMode() });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}