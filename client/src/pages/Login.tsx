import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Login failed' }));
        setError(data.error || 'Invalid email or password');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-900 flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="w-6 h-6">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Job Poster</h1>
          <p className="text-sm text-text-muted mt-1">Recruitment automation</p>
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6">
          <h2 className="text-base font-semibold text-text-primary text-center mb-1">Sign In</h2>
          <p className="text-xs text-text-muted text-center mb-6">Enter your credentials to access the app</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm text-text-secondary font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoFocus
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>

            <label className="block text-sm text-text-secondary font-medium">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>

            {error && (
              <div className="px-3.5 py-2 rounded-lg bg-danger/15 text-danger text-xs font-medium text-center border border-danger/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white shadow-[0_2px_8px_rgba(139,92,246,0.25)] hover:bg-accent-hover transition-all duration-150 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
