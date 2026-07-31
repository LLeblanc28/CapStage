import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Empty, ErrorAlert, Kpi, Loading } from '../components/ui.jsx';
import { STATUS_LABELS, STATUS_TONE, formatDate } from '../labels.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [cvs, setCvs] = useState(null);
  const [applications, setApplications] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([get('/cvs'), get('/applications'), get('/applications/stats')])
      .then(([c, a, s]) => {
        setCvs(c.items);
        setApplications(a.items);
        setStats(s);
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!cvs || !applications || !stats) return <Loading />;

  const mainCv = cvs.find((c) => c.is_default) || cvs[0];
  const count = (status) => stats.by_status.find((s) => s.status === status)?.n ?? 0;

  // Les rappels sont ordonnés : chaque étape débloque la suivante.
  const steps = [
    {
      done: !!mainCv && mainCv.experience_count > 0,
      label: 'Renseigner au moins une expérience ou un projet',
      to: mainCv ? `/cv/${mainCv.id}` : '/cv',
    },
    {
      done: !!mainCv && mainCv.skill_count >= 3,
      label: 'Lister au moins trois compétences',
      to: mainCv ? `/cv/${mainCv.id}` : '/cv',
    },
    {
      done: !!mainCv && mainCv.pdf_exports > 0,
      label: 'Exporter le CV en PDF pour le relire',
      to: mainCv ? `/cv/${mainCv.id}/apercu` : '/cv',
    },
    {
      done: applications.length > 0,
      label: 'Enregistrer une première candidature',
      to: '/candidatures',
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bonjour {user.first_name}.</h1>
          <p>
            {user.program_name
              ? `${user.program_name}${user.cohort_label ? ` — ${user.cohort_label}` : ''}`
              : 'Complétez votre profil pour être rattaché à votre formation.'}
          </p>
        </div>
        <Link className="btn btn--marker" to={mainCv ? `/cv/${mainCv.id}` : '/cv'}>
          {mainCv ? 'Modifier mon CV' : 'Créer mon CV'}
        </Link>
      </div>

      <div className="grid grid--4" style={{ marginBottom: '1.25rem' }}>
        <Kpi value={cvs.length} label={cvs.length > 1 ? 'CV enregistrés' : 'CV enregistré'} />
        <Kpi value={stats.total} label="Candidatures envoyées" marker={stats.total > 0} />
        <Kpi value={count('entretien')} label="Entretiens obtenus" />
        <Kpi value={count('acceptee')} label="Réponses positives" />
      </div>

      <div className="grid grid--2">
        <section className="sheet sheet--ruled">
          <div className="sheet__head">
            <h2>Où vous en êtes</h2>
            <span className="eyebrow">{steps.filter((s) => s.done).length} / {steps.length}</span>
          </div>
          <ol className="list-reset">
            {steps.map((step, i) => (
              <li key={step.label} className="row" style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--rule)' }}>
                <span className="mono small" style={{ color: step.done ? 'var(--ok)' : 'var(--ink-faint)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'var(--ink-faint)' : 'inherit' }}>
                  {step.label}
                </span>
                <span className="spacer" />
                {!step.done && (
                  <Link className="btn btn--ghost btn--sm" to={step.to}>
                    Y aller
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="sheet sheet--ruled">
          <div className="sheet__head">
            <h2>Dernières candidatures</h2>
            <Link className="btn btn--ghost btn--sm" to="/candidatures">
              Tout voir
            </Link>
          </div>
          {applications.length === 0 ? (
            <Empty title="Aucune candidature enregistrée">
              Notez chaque envoi : c’est ce suivi que votre référent consulte avant la visite de stage.
            </Empty>
          ) : (
            <ul className="list-reset">
              {applications.slice(0, 6).map((a) => (
                <li key={a.id} className="row" style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--rule)' }}>
                  <div>
                    <strong>{a.company}</strong>
                    <div className="small muted">
                      {a.position || 'Poste non précisé'} · {formatDate(a.sent_at)}
                    </div>
                  </div>
                  <span className="spacer" />
                  <span className={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
