import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, post } from '../api.js';
import { Checkbox, ConfirmButton, Empty, ErrorAlert, Loading, Modal, Select, TextArea, TextInput } from '../components/ui.jsx';
import {
  CHANNEL_LABELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  VISIT_MODE_LABELS,
  formatDate,
} from '../labels.js';

const blankVisit = () => ({
  visit_date: new Date().toISOString().slice(0, 10),
  mode: 'presentiel',
  comment: '',
  rating: '',
  shared_with_student: true,
});

export default function TutorStudent() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [visitFor, setVisitFor] = useState(null);
  const [visit, setVisit] = useState(blankVisit());
  const [error, setError] = useState(null);

  const load = () => get(`/tutor/students/${id}`).then(setData).catch(setError);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitVisit(e) {
    e.preventDefault();
    try {
      await post(`/applications/${visitFor.id}/visits`, visit);
      setVisitFor(null);
      setVisit(blankVisit());
      load();
    } catch (err) {
      setError(err);
    }
  }

  if (error && !data) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const { student, cvs, applications, visits } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Dossier de suivi</span>
          <h1>
            {student.first_name} {student.last_name}
          </h1>
          <p>
            {[
              student.program_name && `${student.program_name} (${LEVEL_LABELS[student.program_level] || student.program_level})`,
              student.cohort_label,
              student.establishment_name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link className="btn btn--ghost" to="/suivi">
          Retour à la liste
        </Link>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="grid grid--2">
        <section className="sheet sheet--ruled">
          <h2>Contact</h2>
          <p className="small">
            {student.email}
            {student.phone ? ` · ${student.phone}` : ''}
            {student.city ? ` · ${student.city}` : ''}
          </p>
          <p className="small muted">
            Dernière connexion : {student.last_login_at ? formatDate(student.last_login_at) : 'jamais'}
          </p>

          <div className="divider" />
          <h3>CV</h3>
          {cvs.length === 0 ? (
            <p className="small muted">Aucun CV créé pour l’instant.</p>
          ) : (
            <ul className="list-reset">
              {cvs.map((cv) => (
                <li key={cv.id} className="row" style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--rule)' }}>
                  <div>
                    <strong>{cv.title}</strong>
                    <div className="small muted">
                      {cv.headline || 'Sans accroche'} · modifié le {formatDate(cv.updated_at)}
                    </div>
                  </div>
                  <span className="spacer" />
                  <Link className="btn btn--ghost btn--sm" to={`/cv/${cv.id}/apercu`}>
                    Consulter
                  </Link>
                  <a className="btn btn--ghost btn--sm" href={`/api/cvs/${cv.id}/pdf`}>
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sheet sheet--ruled">
          <h2>Comptes rendus de visite</h2>
          {visits.length === 0 ? (
            <Empty title="Aucune visite enregistrée">
              Saisissez un compte rendu depuis la candidature concernée, ci-dessous.
            </Empty>
          ) : (
            <ul className="list-reset">
              {visits.map((v) => (
                <li key={v.id} className="item">
                  <div className="item__head">
                    <span className="small">
                      <strong>{v.company}</strong> · {formatDate(v.visit_date)} · {VISIT_MODE_LABELS[v.mode]}
                    </span>
                    <span className="row row--tight">
                      {v.rating ? <span className="badge">{'★'.repeat(v.rating)}</span> : null}
                      {!v.shared_with_student && <span className="badge badge--warn">Note interne</span>}
                      <ConfirmButton
                        onConfirm={() => del(`/applications/${v.application_id}/visits/${v.id}`).then(load).catch(setError)}
                      >
                        Supprimer
                      </ConfirmButton>
                    </span>
                  </div>
                  <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {v.comment}
                  </p>
                  <p className="small muted" style={{ margin: '0.35rem 0 0' }}>
                    Rédigé par {v.author_first_name} {v.author_last_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="sheet" style={{ marginTop: '1.25rem' }}>
        <div className="sheet__head">
          <h2>Candidatures</h2>
          <span className="eyebrow">{applications.length} démarches</span>
        </div>
        {applications.length === 0 ? (
          <Empty title="Aucune démarche enregistrée">
            L’étudiant n’a encore rien saisi : c’est le premier point à travailler avec lui.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Poste</th>
                  <th>Envoyée le</th>
                  <th>Canal</th>
                  <th>Statut</th>
                  <th>Période</th>
                  <th>Visites</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.company}</strong>
                      {a.city && <div className="small muted">{a.city}</div>}
                    </td>
                    <td>{a.position || '—'}</td>
                    <td className="mono small">{formatDate(a.sent_at)}</td>
                    <td className="small">{CHANNEL_LABELS[a.channel]}</td>
                    <td>
                      <span className={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</span>
                    </td>
                    <td className="small muted">
                      {a.start_date ? `${formatDate(a.start_date)} → ${formatDate(a.end_date)}` : '—'}
                    </td>
                    <td className="mono">{a.visit_count}</td>
                    <td>
                      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setVisitFor(a)}>
                        Ajouter une visite
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {visitFor && (
        <Modal title={`Compte rendu de visite — ${visitFor.company}`} onClose={() => setVisitFor(null)}>
          <form onSubmit={submitVisit}>
            <div className="grid grid--3">
              <TextInput label="Date de la visite" type="date" value={visit.visit_date} onChange={(e) => setVisit({ ...visit, visit_date: e.target.value })} />
              <Select
                label="Mode"
                value={visit.mode}
                onChange={(e) => setVisit({ ...visit, mode: e.target.value })}
                options={Object.entries(VISIT_MODE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Appréciation"
                empty="— Non renseignée —"
                value={visit.rating}
                onChange={(e) => setVisit({ ...visit, rating: e.target.value })}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: '★'.repeat(n) }))}
              />
            </div>
            <TextArea
              label="Observations"
              required
              value={visit.comment}
              onChange={(e) => setVisit({ ...visit, comment: e.target.value })}
              hint="Intégration, missions confiées, retour du tuteur, points de vigilance, suite à donner."
            />
            <Checkbox
              label="Partager ce compte rendu avec l’étudiant"
              checked={visit.shared_with_student}
              onChange={(e) => setVisit({ ...visit, shared_with_student: e.target.checked })}
            />
            <div className="row">
              <button className="btn btn--marker" type="submit">
                Enregistrer le compte rendu
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setVisitFor(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
