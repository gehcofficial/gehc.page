import {
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  createPasskeyLoginOptions,
  verifyPasskeyLogin,
  loginOperatorLocal,
  setOperatorSessionCookie,
  clearOperatorSessionCookie,
  mockPasskeyLogin,
  getWebAuthnConfig,
} from '../platform-auth.mjs';
import {
  listPlatformAdminGrants,
  grantPlatformAdmin,
  revokePlatformAdmin,
  listPlatformAuditLogs,
  searchGrantableUsers,
} from '../platform-operators.mjs';
import { requirePlatformRoot, requirePlatformAdmin } from '../lib/platform-rbac.mjs';

export function registerOperatorRoutes(app, { wrap }) {
  app.get('/api/operator/auth/config', (_req, res) => {
    const { rpID, origin } = getWebAuthnConfig();
    res.json({
      rpId: rpID,
      origin,
      webauthnMock: process.env.WEBAUTHN_MOCK === 'true',
    });
  });

  app.get('/api/operator/auth/me', wrap(async (req, res) => {
    if (!req.platformOperator) {
      return res.status(401).json({ error: 'Belum login sebagai operator.' });
    }
    const grants = await listPlatformAdminGrants();
    res.json({
      operator: {
        id: req.platformOperator.id,
        email: req.platformOperator.email,
        displayName: req.platformOperator.displayName,
        isRoot: req.platformOperator.isRoot,
        lastLoginAt: req.platformOperator.lastLoginAt,
      },
      grants,
      capabilities: req.platformCapabilities || [],
    });
  }));

  app.post('/api/operator/auth/logout', (req, res) => {
    clearOperatorSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/operator/auth/passkey/login-options', wrap(async (req, res) => {
    const email = req.body?.email;
    if (!email) return res.status(400).json({ error: 'email wajib.' });
    const { options } = await createPasskeyLoginOptions(email);
    res.json({ options });
  }));

  app.post('/api/operator/auth/passkey/login', wrap(async (req, res) => {
    const email = req.body?.email;
    const credential = req.body?.credential;
    if (!email || !credential) return res.status(400).json({ error: 'email dan credential wajib.' });
    let operator;
    if (process.env.WEBAUTHN_MOCK === 'true' && req.body?.mock === true) {
      operator = await mockPasskeyLogin(email);
    } else {
      operator = await verifyPasskeyLogin(email, credential);
    }
    setOperatorSessionCookie(res, operator);
    res.json({
      ok: true,
      operator: { id: operator.id, email: operator.email, displayName: operator.displayName },
    });
  }));

  app.post('/api/operator/auth/local', wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email dan password wajib.' });
    const operator = await loginOperatorLocal(email, password);
    setOperatorSessionCookie(res, operator);
    res.json({
      ok: true,
      operator: { id: operator.id, email: operator.email, displayName: operator.displayName },
    });
  }));

  app.post('/api/operator/auth/passkey/register-options', requirePlatformRoot(), wrap(async (req, res) => {
    const options = await createPasskeyRegistrationOptions(req.platformOperator.id);
    res.json({ options });
  }));

  app.post('/api/operator/auth/passkey/register', requirePlatformRoot(), wrap(async (req, res) => {
    await verifyPasskeyRegistration(req.platformOperator.id, req.body?.credential);
    res.json({ ok: true });
  }));

  app.get('/api/operator/users/search', requirePlatformRoot(), wrap(async (req, res) => {
    const users = await searchGrantableUsers(req.query?.q);
    res.json({ users });
  }));

  app.get('/api/operator/admins', requirePlatformRoot(), wrap(async (_req, res) => {
    const grants = await listPlatformAdminGrants();
    res.json({ grants });
  }));

  app.post('/api/operator/admins', requirePlatformRoot(), wrap(async (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId wajib.' });
    const grant = await grantPlatformAdmin({
      operatorId: req.platformOperator.id,
      userId,
      note: req.body?.note,
    });
    res.json({ grant });
  }));

  app.delete('/api/operator/admins/:grantId', requirePlatformRoot(), wrap(async (req, res) => {
    await revokePlatformAdmin({
      operatorId: req.platformOperator.id,
      grantId: req.params.grantId,
    });
    res.json({ ok: true });
  }));

  app.get('/api/operator/audit', requirePlatformRoot(), wrap(async (req, res) => {
    const limit = Number(req.query?.limit) || 50;
    const logs = await listPlatformAuditLogs(limit);
    res.json({ logs });
  }));

  app.get('/api/platform/context', wrap(async (req, res) => {
    res.json({
      isPlatformOperator: Boolean(req.platformOperator),
      isPlatformAdmin: Boolean(req.platformAdmin),
      platformCapabilities: req.platformCapabilities || [],
      operator: req.platformOperator
        ? { id: req.platformOperator.id, email: req.platformOperator.email, displayName: req.platformOperator.displayName }
        : null,
    });
  }));
}
