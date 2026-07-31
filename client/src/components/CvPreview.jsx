import {
  EXPERIENCE_KIND_LABELS,
  LANGUAGE_LEVEL_LABELS,
  SEARCH_KIND_LABELS,
  formatDate,
  period,
} from '../labels.js';

/** Aperçu HTML fidèle aux trois modèles PDF (mêmes blocs, mêmes ordres). */

function Bullets({ text }) {
  if (!text) return null;
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => /^[-*•]/.test(l));
  if (bullets.length === 0) return <div className="preview__meta">{lines.join(' ')}</div>;
  return (
    <ul className="preview__meta">
      {lines.map((line, i) => (
        <li key={i}>{line.replace(/^[-*•]\s?/, '')}</li>
      ))}
    </ul>
  );
}

function Entry({ title, org, city, start, end, current, kind, description }) {
  const meta = [org, city].filter(Boolean).join(' — ');
  const kindLabel = kind && kind !== 'experience' ? EXPERIENCE_KIND_LABELS[kind] : null;
  return (
    <div className="preview__entry">
      <span className="preview__dates">{period(start, end, current)}</span>
      <strong>{title}</strong>
      {(meta || kindLabel) && (
        <div className="preview__meta">{[meta, kindLabel].filter(Boolean).join('  ·  ')}</div>
      )}
      <Bullets text={description} />
    </div>
  );
}

function Sections({ cv, accent }) {
  return (
    <>
      {cv.summary && (
        <>
          <h4 style={{ color: accent }}>Profil</h4>
          <div className="preview__meta">{cv.summary}</div>
        </>
      )}
      {cv.experiences?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Expériences</h4>
          {cv.experiences.map((e, i) => (
            <Entry
              key={i}
              title={e.position}
              org={e.organisation}
              city={e.city}
              start={e.start_date}
              end={e.end_date}
              current={e.current}
              kind={e.kind}
              description={e.description}
            />
          ))}
        </>
      )}
      {cv.educations?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Formation</h4>
          {cv.educations.map((e, i) => (
            <Entry
              key={i}
              title={e.degree}
              org={e.school}
              city={e.city}
              start={e.start_date}
              end={e.end_date}
              current={e.current}
              description={e.description}
            />
          ))}
        </>
      )}
      {cv.certifications?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Certifications</h4>
          {cv.certifications.map((c, i) => (
            <div key={i} className="preview__entry">
              <strong>{c.name}</strong>
              <div className="preview__meta">
                {[c.issuer, formatDate(c.obtained_at)].filter(Boolean).join('  ·  ')}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export default function CvPreview({ cv }) {
  const accent = cv.accent || '#1f6feb';
  const name = `${cv.first_name || ''} ${cv.last_name || ''}`.trim() || 'Votre nom';
  const contact = [cv.contact_email, cv.contact_phone, cv.contact_city, cv.driving_license, cv.mobility]
    .filter(Boolean)
    .join('  ·  ');

  if (cv.template === 'moderne') {
    return (
      <div className="preview preview--moderne">
        <aside className="preview__side" style={{ background: accent }}>
          <div className="preview__name" style={{ fontSize: 17 }}>
            {name}
          </div>
          {cv.headline && <div style={{ fontSize: 11, opacity: 0.92 }}>{cv.headline}</div>}
          {contact && (
            <>
              <h4>Contact</h4>
              <div style={{ fontSize: 11 }}>
                {[cv.contact_email, cv.contact_phone, cv.contact_city].filter(Boolean).map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            </>
          )}
          {cv.links?.length > 0 && (
            <>
              <h4>Liens</h4>
              <div style={{ fontSize: 10.5, wordBreak: 'break-all' }}>
                {cv.links.map((l, i) => (
                  <div key={i}>{l.url}</div>
                ))}
              </div>
            </>
          )}
          {cv.skills?.length > 0 && (
            <>
              <h4>Compétences</h4>
              {cv.skills.map((s, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 5 }}>
                  {s.name}
                  <div style={{ height: 3, background: 'rgba(255,255,255,.3)', borderRadius: 2 }}>
                    <div style={{ width: `${(s.level / 5) * 100}%`, height: '100%', background: '#fff' }} />
                  </div>
                </div>
              ))}
            </>
          )}
          {cv.languages?.length > 0 && (
            <>
              <h4>Langues</h4>
              {cv.languages.map((l, i) => (
                <div key={i} style={{ fontSize: 11 }}>
                  {l.name} — {LANGUAGE_LEVEL_LABELS[l.level] || l.level}
                </div>
              ))}
            </>
          )}
          {cv.interests?.length > 0 && (
            <>
              <h4>Centres d’intérêt</h4>
              {cv.interests.map((i, idx) => (
                <div key={idx} style={{ fontSize: 11 }}>
                  {i.label}
                </div>
              ))}
            </>
          )}
        </aside>
        <div className="preview__body">
          {cv.searching && (
            <span className="chip" style={{ background: `${accent}22`, color: accent }}>
              En recherche : {SEARCH_KIND_LABELS[cv.search_kind]}
            </span>
          )}
          <Sections cv={cv} accent={accent} />
        </div>
      </div>
    );
  }

  const compact = cv.template === 'compact';
  return (
    <div className={`preview${compact ? ' preview--compact' : ''}`}>
      <div style={compact ? { borderLeft: `3px solid ${accent}`, paddingLeft: 10 } : undefined}>
        <div className="preview__name">{compact ? name : name.toUpperCase()}</div>
        {cv.headline && <div style={{ color: accent, fontSize: 12.5 }}>{cv.headline}</div>}
        {contact && <div className="preview__meta">{contact}</div>}
        {cv.links?.length > 0 && (
          <div className="preview__meta" style={{ wordBreak: 'break-all' }}>
            {cv.links.map((l) => `${l.label} : ${l.url}`).join('  ·  ')}
          </div>
        )}
      </div>
      {!compact && <div style={{ height: 2.5, background: accent, margin: '10px 0' }} />}
      {cv.searching && (
        <span className="chip" style={{ background: `${accent}22`, color: accent }}>
          En recherche : {SEARCH_KIND_LABELS[cv.search_kind]}
          {cv.available_from ? ` à partir du ${formatDate(cv.available_from)}` : ''}
        </span>
      )}
      <Sections cv={cv} accent={accent} />
      {cv.skills?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Compétences</h4>
          <div className="chips">
            {cv.skills.map((s, i) => (
              <span className="chip" key={i}>
                {s.name}
                {!compact && ` · ${'●'.repeat(s.level)}${'○'.repeat(5 - s.level)}`}
              </span>
            ))}
          </div>
        </>
      )}
      {cv.languages?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Langues</h4>
          <div className="preview__meta">
            {cv.languages.map((l) => `${l.name} (${LANGUAGE_LEVEL_LABELS[l.level] || l.level})`).join('   ·   ')}
          </div>
        </>
      )}
      {cv.interests?.length > 0 && (
        <>
          <h4 style={{ color: accent }}>Centres d’intérêt</h4>
          <div className="preview__meta">{cv.interests.map((i) => i.label).join('   ·   ')}</div>
        </>
      )}
    </div>
  );
}
