const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config?.();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET === 'CAMBIAR_POR_UN_SECRETO_ALEATORIO_LARGO') {
  console.error('ERROR: configure SESSION_SECRET con al menos 32 caracteres aleatorios en el entorno.');
  process.exit(1);
}
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

fs.mkdirSync(DATA_DIR, { recursive: true });
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
const initialUrl = (process.env.SYSTEM_URL || '').trim();
if (!fs.existsSync(CONFIG_FILE)) writeJson(CONFIG_FILE, {
  systemUrl: validSystemUrl(initialUrl) ? initialUrl : '',
  updatedAt: null
});
if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, []);

function validSystemUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password;
  } catch { return false; }
}
function getConfig() {
  const cfg = readJson(CONFIG_FILE, { systemUrl: '', updatedAt: null });
  return { systemUrl: validSystemUrl(cfg.systemUrl) ? cfg.systemUrl : '', updatedAt: cfg.updatedAt || null };
}
function getUsers() { return readJson(USERS_FILE, []); }
function saveUsers(users) { writeJson(USERS_FILE, users); }

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use(session({
  name: 'viaticos.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000
  }
  // IMPORTANTE: MemoryStore es solo para desarrollo/pruebas.
  // Para producción, configure un almacén de sesiones persistente y respaldado.
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente nuevamente más tarde.' }
});
const configLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.adminId) return res.status(401).json({ error: 'Debe iniciar sesión como administrador.' });
  const user = getUsers().find(u => u.id === req.session.adminId && u.active !== false);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sesión no válida. Inicie sesión nuevamente.' });
  }
  req.admin = user;
  next();
}
function requireCsrf(req, res, next) {
  const token = req.get('x-csrf-token');
  if (!req.session.csrfToken || !token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Validación de seguridad fallida. Recargue la página e intente de nuevo.' });
  }
  next();
}

app.get('/api/public-config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ systemUrl: getConfig().systemUrl, configured: Boolean(getConfig().systemUrl) });
});

app.get('/api/admin/session', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.session.adminId) return res.json({ authenticated: false });
  const user = getUsers().find(u => u.id === req.session.adminId && u.active !== false);
  if (!user) return res.json({ authenticated: false });
  if (!req.session.csrfToken) req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  res.json({ authenticated: true, username: user.username, csrfToken: req.session.csrfToken });
});

app.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password || username.length > 100 || password.length > 200) {
      return res.status(400).json({ error: 'Ingrese usuario y contraseña.' });
    }
    const user = getUsers().find(u => u.username.toLowerCase() === username && u.active !== false);
    // Comparación ficticia cuando no existe el usuario para reducir diferencias temporales.
    const hash = user ? user.passwordHash : '$2a$12$C6UzMDM.H6dfI/f/IKcEe.3b2Q0h7s4v0qFz5F5d2m0YQ2QY2QY2Q';
    const ok = await bcrypt.compare(password, hash).catch(() => false);
    if (!user || !ok) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.adminId = user.id;
      req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
      res.set('Cache-Control', 'no-store');
      res.json({ authenticated: true, username: user.username, csrfToken: req.session.csrfToken });
    });
  } catch (e) { next(e); }
});

app.post('/api/admin/logout', requireAuth, requireCsrf, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'No fue posible cerrar la sesión.' });
    res.clearCookie('viaticos.sid', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    res.json({ ok: true });
  });
});

app.get('/api/admin/config', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getConfig());
});

app.put('/api/admin/config', configLimiter, requireAuth, requireCsrf, (req, res) => {
  const value = String(req.body.systemUrl || '').trim();
  if (value && !validSystemUrl(value)) {
    return res.status(400).json({ error: 'Ingrese una URL HTTPS válida, sin usuario ni contraseña en la dirección.' });
  }
  const cfg = { systemUrl: value, updatedAt: new Date().toISOString() };
  writeJson(CONFIG_FILE, cfg);
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, ...cfg });
});

app.use(express.static(path.join(ROOT, 'public'), {
  index: 'index.html',
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.use((err, req, res, next) => {
  console.error('Error de servidor:', err.message);
  res.status(500).json({ error: 'Ocurrió un error interno. Intente nuevamente.' });
});

app.listen(PORT, () => console.log(`Portal disponible en http://localhost:${PORT}`));
