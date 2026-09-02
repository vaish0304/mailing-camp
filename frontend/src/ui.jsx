export function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-forest-700 text-cream-50 hover:bg-forest-600',
    gold: 'bg-gold-500 text-forest-950 hover:bg-gold-400',
    ghost: 'bg-transparent text-forest-700 hover:bg-cream-100',
    outline: 'border border-forest-700/30 text-forest-700 hover:bg-cream-100',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-xl border border-cream-200 bg-white shadow-sm ${className}`} {...props} />;
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 ${className}`}
      {...props}
    />
  );
}

const BADGE = {
  pending: 'bg-cream-200 text-ink-700',
  sending: 'bg-gold-400/30 text-gold-600',
  sent: 'bg-forest-500/15 text-forest-700',
  delivered: 'bg-forest-500/20 text-forest-700',
  opened: 'bg-blue-100 text-blue-700',
  clicked: 'bg-blue-200 text-blue-800',
  partial: 'bg-gold-400/30 text-gold-600',
  delayed: 'bg-cream-200 text-ink-700',
  failed: 'bg-red-100 text-red-700',
  bounced: 'bg-red-100 text-red-700',
  complained: 'bg-red-200 text-red-800',
  draft: 'bg-cream-200 text-ink-700',
};

export function Badge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${BADGE[status] || 'bg-cream-200 text-ink-700'}`}>
      {status}
    </span>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  const tone = toast.type === 'error' ? 'bg-red-600' : 'bg-forest-700';
  return (
    <div className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg ${tone} px-4 py-3 text-sm text-cream-50 shadow-lg`}>
      {toast.message}
    </div>
  );
}
