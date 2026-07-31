import { useEffect, useState } from 'react';
import { get } from '../api.js';
import { Bar, ErrorAlert, Kpi, Loading } from '../components/ui.jsx';
import { EVENT_LABELS, LEVEL_LABELS, ROLE_LABELS, STATUS_LABELS, formatMonth } from '../labels.js';

/** Histogramme mensuel, dessiné en CSS pour rester léger et imprimable. */
function MonthlyChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  if (data.length === 0) return <p className="small muted">Aucune donnée sur la période.</p>;
  return (
    <div className="row" style={{ alignItems: 'flex-end', gap: '0.4rem', height: 150 }}>
      {data.map((d) => (
        <div key={d.month} style={{ flex: 1, textAlign: 'center' }}>
          <div
            title={`${d.n}`}
            style={{
              height: `${Math.max(4, (d.n / max) * 110)}px`,
              background: 'var(--ink)',
              borderRadius: '3px 3px 0 0',
            }}
          />
          <div className="mono" style={{ fontSize: '0.65rem', marginTop: 4 }}>
            {d.n}
          </div>
          <div className="small muted" style={{ fontSize: '0.62rem' }}>
            {formatMonth(`${d.month}-01`).slice(0, 4)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    get('/admin/stats').then(setStats).catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!stats) return <Loading />;

  const t = stats.totals;
  const maxSkill = Math.max(1, ...stats.top_skills.map((s) => s.n));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Statistiques</h1>
          <p>Usage de la plateforme, tous établissements et tous niveaux de formation confondus.</p>
        </div>
        <div className="row">
          <a className="btn btn--ghost btn--sm" href="/api/admin/export/users.csv">
            Export utilisateurs
          </a>
          <a className="btn btn--ghost btn--sm" href="/api/admin/export/cvs.csv">
            Export CV
          </a>
          <a className="btn btn--ghost btn--sm" href="/api/admin/export/applications.csv">
            Export candidatures
          </a>
        </div>
      </div>

      <div className="grid grid--4" style={{ marginBottom: '1rem' }}>
        <Kpi value={t.users} label="Comptes" />
        <Kpi value={t.cvs} label="CV créés" marker />
        <Kpi value={t.pdf_exports} label="Exports PDF" />
        <Kpi value={t.applications} label="Candidatures suivies" />
      </div>
      <div className="grid grid--4" style={{ marginBottom: '1.5rem' }}>
        <Kpi value={t.visits} label="Comptes rendus de visite" />
        <Kpi value={`${t.placement_rate} %`} label="Étudiants avec une réponse positive" />
        <Kpi value={t.students_without_cv} label="Étudiants sans CV" />
        <Kpi value={t.logins_30d} label="Connexions sur 30 jours" />
      </div>

      <div className="grid grid--2">
        <section className="sheet sheet--ruled">
          <h2>Candidatures par mois</h2>
          <MonthlyChart data={stats.applications_by_month} />
        </section>

        <section className="sheet sheet--ruled">
          <h2>Candidatures par statut</h2>
          {stats.applications_by_status.map((s) => (
            <Bar key={s.status} label={STATUS_LABELS[s.status] || s.status} value={s.n} max={t.applications} />
          ))}
          {stats.applications_by_status.length === 0 && <p className="small muted">Aucune candidature enregistrée.</p>}
        </section>

        <section className="sheet sheet--ruled">
          <h2>Comptes par rôle</h2>
          {stats.users_by_role.map((r) => (
            <Bar key={r.role} label={ROLE_LABELS[r.role] || r.role} value={r.n} max={t.users} />
          ))}
          <div className="divider" />
          <h3>Étudiants par niveau de formation</h3>
          {stats.users_by_level.map((l) => (
            <Bar key={l.label} label={LEVEL_LABELS[l.label] || 'Non renseigné'} value={l.n} max={t.students} />
          ))}
        </section>

        <section className="sheet sheet--ruled">
          <h2>Comptes par établissement</h2>
          {stats.users_by_establishment.map((e) => (
            <Bar key={e.label} label={e.label} value={e.n} max={t.users} />
          ))}
        </section>

        <section className="sheet sheet--ruled">
          <h2>Compétences les plus déclarées</h2>
          {stats.top_skills.length === 0 ? (
            <p className="small muted">Aucune compétence saisie.</p>
          ) : (
            stats.top_skills.map((s) => <Bar key={s.label} label={s.label} value={s.n} max={maxSkill} />)
          )}
        </section>

        <section className="sheet sheet--ruled">
          <h2>Activité des 30 derniers jours</h2>
          {stats.events_by_type.length === 0 ? (
            <p className="small muted">Aucune activité enregistrée.</p>
          ) : (
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Évènement</th>
                    <th>Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.events_by_type.map((e) => (
                    <tr key={e.type}>
                      <td>{EVENT_LABELS[e.type] || e.type}</td>
                      <td className="mono">{e.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
