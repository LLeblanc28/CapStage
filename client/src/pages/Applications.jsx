import { useEffect, useState } from 'react';
import { del, get, post, put, query } from '../api.js';
import {
  ConfirmButton,
  Empty,
  ErrorAlert,
  Kpi,
  Loading,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/ui.jsx';
import {
  CHANNEL_LABELS,
  SEARCH_KIND_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_TONE,
  VISIT_MODE_LABELS,
  formatDate,
} from '../labels.js';

const optionsFrom = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

const blank = () => ({
  company: '',
  position: '',
  city: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  kind: 'stage',
  channel: 'mail',
  sent_at: new Date().toISOString().slice(0, 10),
  status: 'envoyee',
  start_date: '',
  end_date: '',
  company_tutor: '',
  notes: '',
  cv_id: '',
});

/** Parcours d'une candidature : l'ordre des étapes porte l'information. */
function Track({ status }) {
  const index = STATUS_ORDER.indexOf(status);
  const lost = status === 'refusee' || status === 'sans_reponse';
  return (
    <div className="track" aria-label={`Statut : ${STATUS_LABELS[status]}`}>
      {STATUS_ORDER.map((step, i) => (
        <span
          key={step}
          className={`track__step${
            lost && i === 0 ? ' is-lost' : i < index ? ' is-done' : i === index ? ' is-current' : ''
          }`}
        />
      ))}
    </div>
  );
}

export default function Applications() {
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [cvs, setCvs] = useState([]);
  const [filters, setFilters] = useState({ status: '', kind: '', q: '' });
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    Promise.all([get(`/applications${query(filters)}`), get('/applications/stats')])
      .then(([a, s]) => {
        setItems(a.items);
        setStats(s);
      })
      .catch(setError);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rechargement volontaire a chaque filtre
  }, [filters.status, filters.kind, filters.q]);

  useEffect(() => {
    get('/cvs').then((d) => setCvs(d.items)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const payload = { ...editing };
      if (editing.id) await put(`/applications/${editing.id}`, payload);
      else await post('/applications', payload);
      setEditing(null);
      load();
    } catch (err) {
      setError(err);
    }
  }

  const count = (status) => stats?.by_status.find((s) => s.status === status)?.n ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ma recherche</h1>
          <p>
            Une ligne par démarche. C’est ce tableau que votre référent consulte pour vous accompagner
            et préparer la visite de stage.
          </p>
        </div>
        <button className="btn btn--marker" type="button" onClick={() => setEditing(blank())}>
          Enregistrer une candidature
        </button>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {stats && (
        <div className="grid grid--4" style={{ marginBottom: '1.25rem' }}>
          <Kpi value={stats.total} label="Démarches enregistrées" marker={stats.total > 0} />
          <Kpi value={count('relancee')} label="Relances effectuées" />
          <Kpi value={count('entretien')} label="Entretiens" />
          <Kpi value={count('acceptee')} label="Acceptées" />
        </div>
      )}

      <section className="sheet" style={{ marginBottom: '1.25rem' }}>
        <div className="grid grid--3">
          <TextInput label="Rechercher" type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Organisation, poste, ville" />
          <Select label="Statut" empty="Tous" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} options={optionsFrom(STATUS_LABELS)} />
          <Select label="Type" empty="Tous" value={filters.kind} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))} options={optionsFrom(SEARCH_KIND_LABELS)} />
        </div>
      </section>

      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title="Rien d’enregistré pour l’instant"
          action={
            <button className="btn btn--marker" type="button" onClick={() => setEditing(blank())}>
              Enregistrer une candidature
            </button>
          }
        >
          Notez aussi les candidatures spontanées et les relances : elles comptent dans le suivi.
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
                <th>Parcours</th>
                <th>Statut</th>
                <th>Visites</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.company}</strong>
                    {a.city && <div className="small muted">{a.city}</div>}
                  </td>
                  <td>{a.position || '—'}</td>
                  <td className="mono small">{formatDate(a.sent_at)}</td>
                  <td className="small">{CHANNEL_LABELS[a.channel]}</td>
                  <td style={{ minWidth: 90 }}>
                    <Track status={a.status} />
                  </td>
                  <td>
                    <span className={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</span>
                  </td>
                  <td className="mono">{a.visit_count}</td>
                  <td>
                    <div className="row row--tight">
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        onClick={() => get(`/applications/${a.id}`).then(setDetail).catch(setError)}
                      >
                        Détail
                      </button>
                      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing({ ...a, cv_id: a.cv_id || '' })}>
                        Modifier
                      </button>
                      <ConfirmButton onConfirm={() => del(`/applications/${a.id}`).then(load).catch(setError)}>
                        Supprimer
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifier la candidature' : 'Nouvelle candidature'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <div className="grid grid--2">
              <TextInput label="Organisation" required value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              <TextInput label="Poste visé" value={editing.position || ''} onChange={(e) => setEditing({ ...editing, position: e.target.value })} />
              <TextInput label="Ville" value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
              <Select label="Type" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })} options={optionsFrom(SEARCH_KIND_LABELS)} />
              <Select label="Canal" value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} options={optionsFrom(CHANNEL_LABELS)} />
              <TextInput label="Envoyée le" type="date" value={editing.sent_at || ''} onChange={(e) => setEditing({ ...editing, sent_at: e.target.value })} />
              <Select label="Statut" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} options={optionsFrom(STATUS_LABELS)} />
              <Select
                label="CV envoyé"
                empty="— Non précisé —"
                value={editing.cv_id || ''}
                onChange={(e) => setEditing({ ...editing, cv_id: e.target.value })}
                options={cvs.map((c) => ({ value: c.id, label: c.title }))}
              />
              <TextInput label="Contact" value={editing.contact_name || ''} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} />
              <TextInput label="E-mail du contact" type="email" value={editing.contact_email || ''} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} />
              <TextInput label="Téléphone du contact" value={editing.contact_phone || ''} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} />
              <TextInput label="Tuteur en entreprise" value={editing.company_tutor || ''} onChange={(e) => setEditing({ ...editing, company_tutor: e.target.value })} />
              <TextInput label="Début (si acceptée)" type="date" value={editing.start_date || ''} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
              <TextInput label="Fin (si acceptée)" type="date" value={editing.end_date || ''} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
            </div>
            <TextArea label="Notes" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} hint="Date de relance prévue, retour reçu, personne rencontrée…" />
            <div className="row">
              <button className="btn btn--marker" type="submit">
                {editing.id ? 'Enregistrer les modifications' : 'Enregistrer la candidature'}
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setEditing(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.application.company} onClose={() => setDetail(null)}>
          <div className="grid grid--2">
            <div>
              <span className="eyebrow">Poste</span>
              <p>{detail.application.position || 'Non précisé'}</p>
              <span className="eyebrow">Statut</span>
              <p>
                <span className={STATUS_TONE[detail.application.status]}>{STATUS_LABELS[detail.application.status]}</span>
              </p>
              <span className="eyebrow">Contact</span>
              <p className="small">
                {[detail.application.contact_name, detail.application.contact_email, detail.application.contact_phone]
                  .filter(Boolean)
                  .join(' · ') || 'Aucun contact enregistré'}
              </p>
            </div>
            <div>
              <span className="eyebrow">Période</span>
              <p className="small">
                {detail.application.start_date
                  ? `${formatDate(detail.application.start_date)} → ${formatDate(detail.application.end_date)}`
                  : 'Non renseignée'}
              </p>
              <span className="eyebrow">Tuteur en entreprise</span>
              <p className="small">{detail.application.company_tutor || 'Non renseigné'}</p>
              <span className="eyebrow">Notes</span>
              <p className="small">{detail.application.notes || 'Aucune note'}</p>
            </div>
          </div>

          <div className="divider" />
          <h3>Comptes rendus de visite</h3>
          {detail.visits.length === 0 ? (
            <p className="small muted">
              Aucun compte rendu. Ils sont rédigés par votre référent après la visite de stage.
            </p>
          ) : (
            <ul className="list-reset">
              {detail.visits.map((v) => (
                <li key={v.id} className="item">
                  <div className="item__head">
                    <span className="small">
                      <strong>{formatDate(v.visit_date)}</strong> · {VISIT_MODE_LABELS[v.mode]}
                      {v.author_first_name ? ` · ${v.author_first_name} ${v.author_last_name}` : ''}
                    </span>
                    {v.rating ? <span className="badge">{'★'.repeat(v.rating)}</span> : null}
                  </div>
                  <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {v.comment}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
