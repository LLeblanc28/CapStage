import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, query } from '../api.js';
import { Empty, ErrorAlert, Kpi, Loading, TextInput } from '../components/ui.jsx';
import { LEVEL_LABELS, formatDate } from '../labels.js';

export default function TutorStudents() {
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    get('/tutor/overview').then(setOverview).catch(setError);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      get(`/tutor/students${query({ q })}`)
        .then((d) => setItems(d.items))
        .catch(setError);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Étudiants suivis</h1>
          <p>
            Votre périmètre : les promotions qui vous sont rattachées, ou l’ensemble de votre
            établissement si aucune promotion ne vous est assignée.
          </p>
        </div>
        <a className="btn btn--ghost" href="/api/admin/export/applications.csv">
          Exporter les candidatures
        </a>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {overview && (
        <div className="grid grid--4" style={{ marginBottom: '1.25rem' }}>
          <Kpi value={overview.students} label="Étudiants suivis" />
          <Kpi value={`${overview.coverage_rate} %`} label="Ont créé un CV" marker />
          <Kpi value={overview.applications} label="Candidatures enregistrées" />
          <Kpi value={`${overview.placement_rate} %`} label="Ont une réponse positive" />
        </div>
      )}

      {overview && overview.without_application > 0 && (
        <div className="alert alert--info">
          <strong>{overview.without_application}</strong> étudiant(s) n’ont encore enregistré aucune
          démarche. Ce sont eux à relancer en priorité.
        </div>
      )}

      <section className="sheet" style={{ marginBottom: '1.25rem' }}>
        <TextInput label="Rechercher un étudiant" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, prénom, e-mail" />
      </section>

      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="Aucun étudiant dans votre périmètre">
          Un administrateur peut vous rattacher à une ou plusieurs promotions.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Formation</th>
                <th>CV</th>
                <th>Candidatures</th>
                <th>Entretiens</th>
                <th>Acceptées</th>
                <th>Visites</th>
                <th>Dernière connexion</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>
                      {s.last_name} {s.first_name}
                    </strong>
                    <div className="small muted">{s.email}</div>
                  </td>
                  <td className="small">
                    {s.program_name ? `${s.program_name} (${LEVEL_LABELS[s.program_level] || s.program_level})` : '—'}
                    {s.cohort_label && <div className="muted">{s.cohort_label}</div>}
                  </td>
                  <td>
                    {s.cv_count === 0 ? (
                      <span className="badge badge--alert">Aucun</span>
                    ) : (
                      <span className="mono">{s.cv_count}</span>
                    )}
                  </td>
                  <td className="mono">{s.applications}</td>
                  <td className="mono">{s.interviews}</td>
                  <td>
                    {s.accepted > 0 ? <span className="badge badge--ok">{s.accepted}</span> : <span className="mono">0</span>}
                  </td>
                  <td className="mono">{s.visits}</td>
                  <td className="small muted">{s.last_login_at ? formatDate(s.last_login_at) : 'Jamais'}</td>
                  <td>
                    <Link className="btn btn--ghost btn--sm" to={`/suivi/${s.id}`}>
                      Dossier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
