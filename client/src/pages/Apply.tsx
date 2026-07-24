import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface PositionOption {
  _id: string;
  title: string;
  description: string;
  salary?: string;
  hours?: string;
  languageRequired?: string;
}

const GRADUATION_OPTIONS = ['Graduate', 'Undergraduate', 'Gap Year', 'Drop Out'] as const;
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export default function Apply() {
  const { slug } = useParams<{ slug: string }>();
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [positionError, setPositionError] = useState('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    graduation: '',
    experience: '',
    language: '',
    languageLevel: '',
    nationality: '',
    position: '',
    recordingUrl: '',
  });

  useEffect(() => {
    if (!slug) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    fetch(`/api/public/positions/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('invalid');
        return r.json();
      })
      .then((data) => {
        setPositions(data);
        setLoading(false);
      })
      .catch(() => {
        setInvalid(true);
        setLoading(false);
      });
  }, [slug]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPositionError('');

    if (!form.position) {
      setPositionError('Please select a position above');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/public/candidates/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  if (invalid) {
    return (
      <div className="min-h-screen bg-bg-900 flex items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-danger/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#e5605a" strokeWidth="2" className="w-8 h-8">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">This link isn't valid</h1>
          <p className="text-text-secondary">
            The application link you used is invalid or expired. Please check with the person who sent it to you.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg-900 flex items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#4caf7d" strokeWidth="2.5" className="w-8 h-8">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Application Received</h1>
          <p className="text-text-secondary">
            Thank you for applying! We'll review your submission and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
  const labelClass = 'block text-sm text-text-secondary font-medium';
  const fieldsetClass = 'rounded-xl border border-border bg-surface p-6';
  const selectClass = inputClass;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg-900 p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold text-text-primary">Apply for a Position</h1>
          <p className="text-sm text-text-muted mt-1">Fill out the form below to submit your application</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className={fieldsetClass}>
            <legend className="text-xs font-bold uppercase tracking-wider text-accent mb-4">
              Personal Information
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                Candidate Name
                <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="Full name" />
              </label>
              <label className={labelClass}>
                Phone
                <input className={inputClass} value={form.phone} onChange={set('phone')} required placeholder="Phone number" />
              </label>
              <label className={labelClass}>
                Graduation
                <select className={selectClass} value={form.graduation} onChange={set('graduation')} required>
                  <option value="">Select graduation status...</option>
                  {GRADUATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Experience
                <input className={inputClass} value={form.experience} onChange={set('experience')} required placeholder="e.g. 2 years customer service" />
              </label>
              <label className={labelClass}>
                Language
                <input className={inputClass} value={form.language} onChange={set('language')} required placeholder="e.g. English" />
              </label>
              <label className={labelClass}>
                Language Level
                <select className={selectClass} value={form.languageLevel} onChange={set('languageLevel')} required>
                  <option value="">Select CEFR level...</option>
                  {CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Nationality
                <input className={inputClass} value={form.nationality} onChange={set('nationality')} required placeholder="Your nationality" />
              </label>
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className="text-xs font-bold uppercase tracking-wider text-accent mb-4">
              Voice Note
            </legend>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-sm text-text-primary leading-relaxed">
                <p className="mb-2">📌 Kindly send me a voice note for a minute minimum in English, otherwise it will be declined.</p>
                <p className="mb-2">Answering these questions:</p>
                <ol className="list-decimal list-inside space-y-1 mb-2 text-text-secondary">
                  <li>Introduce yourself.</li>
                  <li>Talk about your work experience and your hobbies.</li>
                  <li>Why do you want to work at a call center?</li>
                </ol>
                <p className="mb-2">Note that if your voice note is less than 1 minute, it will be declined.</p>
                <p>Don't worry, I will help you if something goes wrong.</p>
              </div>

              <div className="p-4 rounded-lg bg-bg-600/50 border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">How to record</p>
                <ol className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                    <span>Go to <a href="https://vocaroo.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">vocaroo.com</a></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                    <span>Click the red microphone button and allow microphone access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                    <span>Answer the 3 questions above (at least 1 minute)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                    <span>Click the red button again to stop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                    <span>Click "Copy link" (or similar share option) and paste that link in the box below</span>
                  </li>
                </ol>
              </div>

              <label className={labelClass}>
                Recording link
                <input className={inputClass} value={form.recordingUrl} onChange={set('recordingUrl')} required placeholder="Paste your Vocaroo link here" />
              </label>
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className="text-xs font-bold uppercase tracking-wider text-accent mb-4">
              Choose a Position
            </legend>
            {positionError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-danger/15 text-danger text-sm font-medium border border-danger/20">
                {positionError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positions.map((p) => {
                const selected = form.position === p._id;
                return (
                  <div
                    key={p._id}
                    onClick={() => {
                      setForm((f) => ({ ...f, position: p._id }));
                      setPositionError('');
                    }}
                    className={`rounded-xl border p-5 cursor-pointer transition-all duration-150 ${
                      selected
                        ? 'border-accent bg-accent/5 shadow-[0_0_0_1px_rgba(139,92,246,0.3)]'
                        : 'border-border bg-surface hover:border-accent/40 hover:bg-white/[0.02]'
                    }`}
                  >
                    <h3 className={`font-semibold text-sm mb-2 ${selected ? 'text-accent' : 'text-text-primary'}`}>
                      {p.title}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed mb-3 line-clamp-3">
                      {p.description}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                      {p.salary && <span>💰 {p.salary}</span>}
                      {p.hours && <span>⏰ {p.hours}</span>}
                      {p.languageRequired && <span>🌐 {p.languageRequired}</span>}
                    </div>
                  </div>
                );
              })}
              {positions.length === 0 && (
                <p className="col-span-full text-sm text-text-muted text-center py-8">
                  No positions available at the moment.
                </p>
              )}
            </div>
          </fieldset>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-danger/15 text-danger text-sm font-medium border border-danger/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-accent text-white shadow-[0_2px_10px_rgba(139,92,246,0.3)] hover:bg-accent-hover transition-all duration-150 disabled:opacity-50"
          >
            {sending ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
