/** Express async error wrapper */
export const wrap = (fn) => (req, res, next) =>
  fn(req, res, next).catch((err) => {
    console.error(`[api] ${req.method} ${req.path} →`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });
