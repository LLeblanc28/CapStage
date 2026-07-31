import { useEffect, useState } from 'react';

export function Field({ label, hint, children, id }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function TextInput({ label, hint, id, ...props }) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} id={inputId}>
      <input id={inputId} {...props} />
    </Field>
  );
}

export function TextArea({ label, hint, id, ...props }) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} id={inputId}>
      <textarea id={inputId} {...props} />
    </Field>
  );
}

export function Select({ label, hint, id, options, empty, ...props }) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} id={inputId}>
      <select id={inputId} {...props}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Kpi({ value, label, marker = false }) {
  return (
    <div className="kpi">
      <div className="kpi__value">{marker ? <span className="marker">{value}</span> : value}</div>
      <div className="kpi__label">{label}</div>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

/** Affiche une erreur d'API, y compris le detail des champs invalides. */
export function ErrorAlert({ error, onClose }) {
  if (!error) return null;
  const details = error.details;
  return (
    <div className="alert alert--error" role="alert">
      <div className="row">
        <strong>{error.message || String(error)}</strong>
        {onClose && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
      {Array.isArray(details) && details.length > 0 && (
        <ul>
          {details.map((d, i) => (
            <li key={i}>
              {d.field ? `${d.field} : ` : ''}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  if (!children) return null;
  return <div className={`alert alert--${tone}`}>{children}</div>;
}

export function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={wide ? { width: 'min(980px, 100%)' } : undefined}>
        <div className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bouton qui demande une confirmation avant d'agir. */
export function ConfirmButton({ onConfirm, children, question = 'Confirmer ?', className = 'btn btn--danger btn--sm' }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return undefined;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);

  if (asking) {
    return (
      <span className="row row--tight">
        <button type="button" className="btn btn--danger btn--sm" onClick={() => { setAsking(false); onConfirm(); }}>
          {question}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(false)}>
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setAsking(true)}>
      {children}
    </button>
  );
}

export function Loading({ label = 'Chargement…' }) {
  return <p className="muted small">{label}</p>;
}

/** Barre de progression simple, utilisee dans les tableaux de bord. */
export function Bar({ value, max, label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div className="row small" style={{ justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className="mono">{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ink)' }} />
      </div>
    </div>
  );
}
