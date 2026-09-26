'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AUTH_REQUEST_TIMEOUT_MS = 15000;

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AUTH_REQUEST_TIMEOUT')), timeoutMs)),
  ]);
}

function isAuthNetworkError(message: string) {
  return /failed to fetch|load failed|networkerror|network request failed|could not resolve hostname|err_name_not_resolved/i.test(message);
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await withTimeout(supabase.auth.signInWithPassword({
        email,
        password,
      }), AUTH_REQUEST_TIMEOUT_MS);

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
          : isAuthNetworkError(authError.message)
            ? 'No se pudo conectar con el servicio de acceso. Intenta nuevamente en unos segundos.'
            : authError.message);
        return;
      }

      const { data: profile } = await withTimeout(supabase.from('profiles').select('role, juntas(subscription_plan)').eq('id', authData.user.id).single(), AUTH_REQUEST_TIMEOUT_MS);
      const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
      router.push(profile?.role === 'dirigente' && junta?.subscription_plan === 'web' ? '/mi-pagina' : '/inicio');
      router.refresh();
    } catch (loginError) {
      const message = loginError instanceof Error && loginError.message === 'AUTH_REQUEST_TIMEOUT'
        ? 'El servicio de acceso está tardando demasiado. Revisa tu conexión e intenta nuevamente.'
        : 'No se pudo conectar con el servicio de acceso. Intenta nuevamente en unos segundos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function recoverPassword() {
    setError('');
    setRecoveryMessage('');
    if (!email.trim()) {
      setError('Ingresa tu correo para recuperar la contraseña.');
      return;
    }
    setRecoveryLoading(true);
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No fue posible solicitar la recuperación.');
      setRecoveryMessage(result.message);
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'No fue posible solicitar la recuperación.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form active">
      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="form-input"
          placeholder="tu@correo.cl"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="form-input"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="auth-error-message">{error}</div>
      )}

      {recoveryMessage && <p className="form-help">{recoveryMessage}</p>}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary btn-block btn-lg"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
      <button type="button" className="btn btn-ghost btn-block" disabled={loading || recoveryLoading} onClick={() => void recoverPassword()}>
        {recoveryLoading ? 'Enviando enlace…' : '¿Olvidaste tu contraseña?'}
      </button>
    </form>
  );
}
