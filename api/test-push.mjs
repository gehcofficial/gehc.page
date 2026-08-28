import { sendPushNotification, broadcastPushNotification, notifyNewWarta, notifyNewGallery, notifyNewSchedule, notifyOrderUpdate } from '../server/push.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing push module...');
    return res.json({ ok: true, message: 'Push module works' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}