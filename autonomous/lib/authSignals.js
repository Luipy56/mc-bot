'use strict';

/**
 * Detect auth-related server hints from messagestr/kick text.
 * Returns:
 * - needs_login
 * - needs_register
 * - register_blocked
 * - login_ok
 * - wrong_password
 * - null
 */
function detectAuthSignal(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return null;

  if (/wrong password|incorrect password|invalid password|bad password|contrasena incorrecta|contraseña incorrecta/.test(text)) {
    return 'wrong_password';
  }
  if (/maximum number of registrations|too many registrations|exceeded .* registrations/.test(text)) {
    return 'register_blocked';
  }
  if (/successful login|login successful|logged in successfully|you are now logged in|you are logged in|sesion iniciada|sesión iniciada|bienvenido/.test(text)) {
    return 'login_ok';
  }
  if (/isn'?t registered|not registered|\/register|register|registrate|registrarse|reg[ií]strate/.test(text)) {
    return 'needs_register';
  }
  if (/must be authenticated|login timeout exceeded|must login|\/login|inicia sesion|inicia sesión|debes iniciar/.test(text)) {
    return 'needs_login';
  }
  return null;
}

module.exports = { detectAuthSignal };
