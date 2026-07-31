import { useEffect, useState } from 'react';
import { del, get, patch, post, query } from '../api.js';
import {
  ConfirmButton,
  Empty,
  ErrorAlert,
  Loading,
  Modal,
  Notice,
  Select,
  TextArea,
  TextInput,
} from '../components/ui.jsx';
import { LEVEL_LABELS, ROLE_LABELS, formatDate } from '../labels.js';

const CSV_EXAMPLE = `email;prenom;nom;role;etablissement;promotion
marie.dupont@exemple.fr;Marie;Dupont;student;Lycee Fulbert;1re annee 2025-2026
paul.martin@exemple.fr;Paul;Martin;student;Lycee Fulbert;1re annee 2025-2026`;

export default function AdminUsers() {
  const [items, setItems] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [filters, setFilters] = useState({ q: '', role: '', establishment_id: '' });
  const [creating, setCreating] = useState(null);
  const [importing, setImporting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    get(`/admin/users${query(filters)}`)
      .then((d) => setItems(d.items))
      .catch(setError);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.role, filters.establishment_id]);

  useEffect(() => {
    get('/referentiel/establishments').then((d) => setEstablishments(d.items)).catch(() => {});
    get('/referentiel/cohorts').then((d) => setCohorts(d.items)).catch(() => {});
  }, []);

  async function createUser(e) {
    e.preventDefault();
    try {
      const data = await post('/admin/users', creating);
      setCredentials({ title: 'Compte créé', rows: [{ email: creating.email, temp_password: data.temp_password }] });
      setCreating(null);
      load();
    } catch (err) {
      setError(err);
    }
  }

  async function runImport(e) {
    e.preventDefault();
    try {
      const data = await post('/admin/users/import', { csv: importing });
      setCredentials({
        title: `${data.created.length} compte(s) créé(s)`,
        rows: data.created,
        errors: data.errors,
      });
      setImporting(null);
      load();
    } catch (err) {
      setError(err);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await patch(`/admin/users/${editing.id}`, {
        first_name: editing.first_name,
        last_name: editing.last_name,
        email: editing.email,
        role: editing.role,
        establishment_id: editing.establishment_id || null,
        cohort_id: editing.cohort_id || null,
        active: editing.active,
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Comptes</h1>
          <p>
            Créez les comptes un par un ou importez une promotion entière depuis un fichier CSV exporté
            de votre système d’information.
          </p>
        </div>
        <div className="row">
          <button className="btn btn--ghost" type="button" onClick={() => setImporting(CSV_EXAMPLE)}>
            Importer un CSV
          </button>
          <button
            className="btn btn--marker"
            type="button"
            onClick={() => setCreating({ email: '', first_name: '', last_name: '', role: 'student', establishment_id: '', cohort_id: '' })}
          >
            Nouveau compte
          </button>
        </div>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <section className="sheet" style={{ marginBottom: '1.25rem' }}>
        <div className="grid grid--3">
          <TextInput label="Rechercher" type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Nom, prénom, e-mail" />
          <Select
            label="Rôle"
            empty="Tous"
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Établissement"
            empty="Tous"
            value={filters.establishment_id}
            onChange={(e) => setFilters({ ...filters, establishment_id: e.target.value })}
            options={establishments.map((e) => ({ value: e.id, label: e.name }))}
          />
        </div>
      </section>

      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="Aucun compte ne correspond">Modifiez les filtres ou créez un compte.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Établissement</th>
                <th>Formation</th>
                <th>CV</th>
                <th>Candid.</th>
                <th>Dernière connexion</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                  <td>
                    <strong>
                      {u.last_name} {u.first_name}
                    </strong>
                    <div className="small muted">{u.email}</div>
                  </td>
                  <td>
                    <span className="badge">{ROLE_LABELS[u.role]}</span>
                    {!u.active && <span className="badge badge--alert">Désactivé</span>}
                  </td>
                  <td className="small">{u.establishment_name || '—'}</td>
                  <td className="small">
                    {u.program_name ? `${u.program_name} (${LEVEL_LABELS[u.program_level] || u.program_level})` : '—'}
                    {u.cohort_label && <div className="muted">{u.cohort_label}</div>}
                  </td>
                  <td className="mono">{u.cv_count}</td>
                  <td className="mono">{u.application_count}</td>
                  <td className="small muted">{u.last_login_at ? formatDate(u.last_login_at) : 'Jamais'}</td>
                  <td>
                    <div className="row row--tight">
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        onClick={() => setEditing({ ...u, establishment_id: u.establishment_id || '', cohort_id: u.cohort_id || '' })}
                      >
                        Modifier
                      </button>
                      <ConfirmButton
                        className="btn btn--ghost btn--sm"
                        question="Réinitialiser ?"
                        onConfirm={() =>
                          post(`/admin/users/${u.id}/reset-password`)
                            .then((d) =>
                              setCredentials({
                                title: 'Mot de passe réinitialisé',
                                rows: [{ email: u.email, temp_password: d.temp_password }],
                              }),
                            )
                            .catch(setError)
                        }
                      >
                        Mot de passe
                      </ConfirmButton>
                      <ConfirmButton
                        question="Supprimer le compte et ses CV ?"
                        onConfirm={() => del(`/admin/users/${u.id}`).then(load).catch(setError)}
                      >
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

      {creating && (
        <Modal title="Nouveau compte" onClose={() => setCreating(null)}>
          <form onSubmit={createUser}>
            <div className="grid grid--2">
              <TextInput label="Prénom" required value={creating.first_name} onChange={(e) => setCreating({ ...creating, first_name: e.target.value })} />
              <TextInput label="Nom" required value={creating.last_name} onChange={(e) => setCreating({ ...creating, last_name: e.target.value })} />
            </div>
            <TextInput label="Adresse e-mail" type="email" required value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
            <div className="grid grid--3">
              <Select
                label="Rôle"
                value={creating.role}
                onChange={(e) => setCreating({ ...creating, role: e.target.value })}
                options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Établissement"
                empty="— Aucun —"
                value={creating.establishment_id}
                onChange={(e) => setCreating({ ...creating, establishment_id: e.target.value })}
                options={establishments.map((e) => ({ value: e.id, label: e.name }))}
              />
              <Select
                label="Promotion"
                empty="— Aucune —"
                value={creating.cohort_id}
                onChange={(e) => setCreating({ ...creating, cohort_id: e.target.value })}
                options={cohorts
                  .filter((c) => !creating.establishment_id || String(c.establishment_id) === String(creating.establishment_id))
                  .map((c) => ({ value: c.id, label: `${c.program_name} — ${c.label}` }))}
              />
            </div>
            <p className="small muted">
              Un mot de passe provisoire est généré ; il est affiché une seule fois, après la création.
            </p>
            <button className="btn btn--marker" type="submit">
              Créer le compte
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Modifier le compte" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit}>
            <div className="grid grid--2">
              <TextInput label="Prénom" value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
              <TextInput label="Nom" value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
            </div>
            <TextInput label="Adresse e-mail" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            <div className="grid grid--3">
              <Select
                label="Rôle"
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Établissement"
                empty="— Aucun —"
                value={editing.establishment_id}
                onChange={(e) => setEditing({ ...editing, establishment_id: e.target.value, cohort_id: '' })}
                options={establishments.map((e) => ({ value: e.id, label: e.name }))}
              />
              <Select
                label="Promotion"
                empty="— Aucune —"
                value={editing.cohort_id}
                onChange={(e) => setEditing({ ...editing, cohort_id: e.target.value })}
                options={cohorts
                  .filter((c) => !editing.establishment_id || String(c.establishment_id) === String(editing.establishment_id))
                  .map((c) => ({ value: c.id, label: `${c.program_name} — ${c.label}` }))}
              />
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              <span>Compte actif (un compte désactivé ne peut plus se connecter)</span>
            </label>
            <button className="btn btn--marker" type="submit">
              Enregistrer
            </button>
          </form>
        </Modal>
      )}

      {importing !== null && (
        <Modal title="Importer des comptes" onClose={() => setImporting(null)} wide>
          <form onSubmit={runImport}>
            <p className="small muted">
              Colonnes attendues : <code>email;prenom;nom;role;etablissement;promotion</code>. Le
              séparateur peut être <code>;</code> ou <code>,</code>. L’établissement est créé s’il
              n’existe pas ; la promotion doit exister au préalable.
            </p>
            <TextArea
              label="Contenu du fichier CSV"
              value={importing}
              onChange={(e) => setImporting(e.target.value)}
              style={{ minHeight: 220, fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}
            />
            <div className="row">
              <button className="btn btn--marker" type="submit">
                Lancer l’import
              </button>
              <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>
                Charger un fichier
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file.text().then(setImporting);
                  }}
                />
              </label>
            </div>
          </form>
        </Modal>
      )}

      {credentials && (
        <Modal title={credentials.title} onClose={() => setCredentials(null)} wide>
          <Notice tone="info">
            Ces mots de passe provisoires ne seront plus affichés. Copiez-les maintenant et
            transmettez-les à leurs titulaires, qui devront les changer.
          </Notice>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Adresse e-mail</th>
                  <th>Mot de passe provisoire</th>
                </tr>
              </thead>
              <tbody>
                {credentials.rows.map((row) => (
                  <tr key={row.email}>
                    <td>{row.email}</td>
                    <td className="mono">{row.temp_password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {credentials.errors?.length > 0 && (
            <>
              <div className="divider" />
              <h3>Lignes ignorées</h3>
              <ul className="small">
                {credentials.errors.map((e, i) => (
                  <li key={i}>
                    Ligne {e.line} ({e.email || 'sans e-mail'}) : {e.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
