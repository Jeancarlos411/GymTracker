const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SQL_DRIVER = (process.env.SQL_DRIVER || 'tedious').toLowerCase();
let sql;
try {
  sql = SQL_DRIVER === 'msnodesqlv8' ? require('mssql/msnodesqlv8') : require('mssql');
} catch (error) {
  console.warn(
    'No se pudo cargar el cliente de SQL Server. Las operaciones de autenticación no estarán disponibles.',
    error
  );
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8); // 8 horas
const LOGIN_QUERY =
  process.env.SQL_LOGIN_QUERY ||
  'SELECT TOP 1 username FROM AdminUsers WHERE username = @username AND password = @password';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const activeSessions = new Map();
let sqlPoolPromise = null;

function getSqlConfig() {
  if (!sql) return null;

  if (process.env.SQL_CONNECTION_STRING) {
    return {
      connectionString: process.env.SQL_CONNECTION_STRING,
    };
  }

  const config = {
    server: process.env.SQL_SERVER || '(localdb)\\MSSQLLocalDB',
    database: process.env.SQL_DATABASE || 'GymTracker',
    options: {
      encrypt: process.env.SQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== 'false',
    },
    pool: {
      max: Number(process.env.SQL_POOL_MAX || 10),
      min: Number(process.env.SQL_POOL_MIN || 0),
      idleTimeoutMillis: Number(process.env.SQL_POOL_IDLE || 30000),
    },
  };

  if (process.env.SQL_USER) {
    config.user = process.env.SQL_USER;
  }

  if (process.env.SQL_PASSWORD) {
    config.password = process.env.SQL_PASSWORD;
  }

  if (process.env.SQL_PORT) {
    config.port = Number(process.env.SQL_PORT);
  }

  return config;
}

async function getSqlPool() {
  if (!sql) {
    throw new Error('Cliente SQL no disponible. Verifica que el paquete "mssql" esté instalado.');
  }

  const config = getSqlConfig();
  if (!config) {
    throw new Error('Configuración SQL incompleta. Revisa tus variables de entorno.');
  }

  if (!sqlPoolPromise) {
    sqlPoolPromise = sql.connect(config).catch((err) => {
      sqlPoolPromise = null;
      throw err;
    });
  }

  return sqlPoolPromise;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
    }
  }
}

function getSessionTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    if (name === 'adminSession') {
      return valueParts.join('=');
    }
  }
  return null;
}

function createSession(username) {
  cleanupExpiredSessions();
  const token = crypto.randomBytes(24).toString('hex');
  activeSessions.set(token, { username, createdAt: Date.now() });
  return token;
}

function invalidateSession(token) {
  if (!token) return false;
  return activeSessions.delete(token);
}

function validateSession(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(Object.assign(new Error('Payload demasiado grande'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        const error = new Error('JSON inválido en la petición');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function authenticateAdmin(username, password) {
  if (!username || !password) return false;
  const pool = await getSqlPool();
  const request = pool.request();
  request.input('username', sql.NVarChar(255), username);
  request.input('password', sql.NVarChar(255), password);
  const result = await request.query(LOGIN_QUERY);
  return result.recordset.length > 0;
}

async function handleLogin(req, res) {
  if (!sql) {
    sendJson(res, 500, { success: false, message: 'El servidor no tiene soporte SQL configurado.' });
    return;
  }

  let credentials;
  try {
    credentials = await parseRequestBody(req);
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(res, status, { success: false, message: err.message });
    return;
  }

  const { username, password } = credentials;

  if (!username || !password) {
    sendJson(res, 400, {
      success: false,
      message: 'Debes proporcionar usuario y contraseña.',
    });
    return;
  }

  try {
    const isValid = await authenticateAdmin(username, password);
    if (!isValid) {
      sendJson(res, 401, { success: false, message: 'Credenciales inválidas.' });
      return;
    }

    const sessionToken = createSession(username);
    sendJson(
      res,
      200,
      { success: true },
      {
        'Set-Cookie': `adminSession=${sessionToken}; HttpOnly; Path=/; Max-Age=${Math.floor(
          SESSION_TTL_MS / 1000
        )}; SameSite=Lax`,
      }
    );
  } catch (error) {
    console.error('Error al autenticar admin:', error);
    sendJson(res, 500, {
      success: false,
      message: 'Error interno al autenticar. Revisa la conexión a la base de datos.',
    });
  }
}

function handleLogout(req, res) {
  const token = getSessionTokenFromRequest(req);
  invalidateSession(token);
  sendJson(
    res,
    200,
    { success: true },
    {
      'Set-Cookie': 'adminSession=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
    }
  );
}

function handleSessionCheck(req, res) {
  const token = getSessionTokenFromRequest(req);
  const session = validateSession(token);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }
  sendJson(res, 200, { authenticated: true, username: session.username });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}:`, err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error interno del servidor');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const decodedPathname = decodeURIComponent(requestUrl.pathname);
  let filePath = path.resolve(PUBLIC_DIR, `.${decodedPathname}`);

  if (decodedPathname === '/api/login' && req.method === 'POST') {
    handleLogin(req, res);
    return;
  }

  if (decodedPathname === '/api/logout' && req.method === 'POST') {
    handleLogout(req, res);
    return;
  }

  if (decodedPathname === '/api/session' && req.method === 'GET') {
    handleSessionCheck(req, res);
    return;
  }

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      const notFoundPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(notFoundPath)) {
        sendFile(res, notFoundPath);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Recurso no encontrado');
      }
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (dirErr) => {
        if (dirErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Recurso no encontrado');
          return;
        }
        sendFile(res, filePath);
      });
      return;
    }

    sendFile(res, filePath);
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
