import { useEffect, useState } from 'react';
import { del, get, post, put } from '../api.js';
import { ConfirmButton, Empty, ErrorAlert, Loading, Modal, Select, TextInput } from '../components/ui.jsx';
import { ESTABLISHMENT_KIND_LABELS, LEVEL_LABELS } from '../labels.js';

const optionsFrom = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

const TABS = [
  { key: 'establishments', label: 'Établissements' },
  { key: 'programs', label: 'Formations' },
  { key: 'cohorts', label: 'Promotions' },
];

export default function AdminReferentiel() {
  const [tab, setTab] = useState('establishments');
  const [data, setData] = useState({ establishments: null, programs: null, cohorts: null });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    Promise.all([get('/admin/establishments'), get('/admin/programs'), get('/admin/cohorts')])
      .then(([e, p, c]) => setData({ establishments: e.items, programs: p.items, cohorts: c.items }))
      .catch(setError);

  useEffect(() => {
    load();
  }, []);

  const establishmentName = (id) => data.establishments?.find((e) => e.id === id)?.name || 'Formation générique';
  const programName = (id) => data.programs?.find((p) => p.id === id)?.name || '—';

  const blanks = {
    establishments: { name: '', kind: 'lycee', city: '', country: 'France', website: '', active: true },
    programs: { establishment_id: '', name: '', level: 'bts', field: '', duration_years: 2, internship_required: true, active: true },
    cohorts: { program_id: '', label: '', year_level: 1, start_year: new Date().getFullYear(), end_year: new Date().getFullYear() + 1, active: true },
  };

  async function submit(e) {
    e.preventDefault();
    const { __type: type, id, ...payload } = editing;
    try {
      if (id) await put(`/admin/${type}/${id}`, payload);
      else await post(`/admin/${type}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      setError(err);
    }
  }

  const rows = data[tab];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Établissements et formations</h1>
          <p>
            Le référentiel qui structure la plateforme. Tous les niveaux sont pris en charge : collège,
            CAP, bac pro, bac techno, BTS, BUT, licence, master, titre professionnel…
          </p>
        </div>
        <button
          className="btn btn--marker"
          type="button"
          onClick={() => setEditing({ __type: tab, ...blanks[tab] })}
        >
          Ajouter
        </button>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="row no-print" style={{ marginBottom: '1rem' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'btn btn--sm' : 'btn btn--ghost btn--sm'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title="Rien à afficher">Commencez par créer un établissement, puis ses formations.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              {tab === 'establishments' && (
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Ville</th>
                  <th>Actif</th>
                  <th aria-label="Actions" />
                </tr>
              )}
              {tab === 'programs' && (
                <tr>
                  <th>Formation</th>
                  <th>Niveau</th>
                  <th>Établissement</th>
                  <th>Domaine</th>
                  <th>Durée</th>
                  <th aria-label="Actions" />
                </tr>
              )}
              {tab === 'cohorts' && (
                <tr>
                  <th>Promotion</th>
                  <th>Formation</th>
                  <th>Année</th>
                  <th>Période</th>
                  <th aria-label="Actions" />
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {tab === 'establishments' && (
                    <>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="small">{ESTABLISHMENT_KIND_LABELS[row.kind] || row.kind}</td>
                      <td className="small">{row.city || '—'}</td>
                      <td>{row.active ? <span className="badge badge--ok">Actif</span> : <span className="badge">Inactif</span>}</td>
                    </>
                  )}
                  {tab === 'programs' && (
                    <>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>
                        <span className="badge">{LEVEL_LABELS[row.level] || row.level}</span>
                      </td>
                      <td className="small">{establishmentName(row.establishment_id)}</td>
                      <td className="small">{row.field || '—'}</td>
                      <td className="mono small">{row.duration_years} an(s)</td>
                    </>
                  )}
                  {tab === 'cohorts' && (
                    <>
                      <td>
                        <strong>{row.label}</strong>
                      </td>
                      <td className="small">{programName(row.program_id)}</td>
                      <td className="mono small">Année {row.year_level}</td>
                      <td className="small">
                        {row.start_year} – {row.end_year}
                      </td>
                    </>
                  )}
                  <td>
                    <div className="row row--tight">
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        onClick={() => setEditing({ __type: tab, ...row, active: !!row.active })}
                      >
                        Modifier
                      </button>
                      <ConfirmButton
                        question="Supprimer ? Les rattachements seront perdus."
                        onConfirm={() => del(`/admin/${tab}/${row.id}`).then(load).catch(setError)}
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

      {editing && (
        <Modal
          title={editing.id ? 'Modifier' : 'Ajouter'}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={submit}>
            {editing.__type === 'establishments' && (
              <>
                <TextInput label="Nom" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <div className="grid grid--2">
                  <Select label="Type" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })} options={optionsFrom(ESTABLISHMENT_KIND_LABELS)} />
                  <TextInput label="Ville" value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                  <TextInput label="Pays" value={editing.country || 'France'} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
                  <TextInput label="Site web" value={editing.website || ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} />
                </div>
              </>
            )}

            {editing.__type === 'programs' && (
              <>
                <TextInput label="Nom de la formation" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="BTS SIO, Licence Histoire, CAP Électricien…" />
                <div className="grid grid--2">
                  <Select label="Niveau" value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })} options={optionsFrom(LEVEL_LABELS)} />
                  <Select
                    label="Établissement"
                    empty="— Formation générique —"
                    value={editing.establishment_id || ''}
                    onChange={(e) => setEditing({ ...editing, establishment_id: e.target.value })}
                    options={(data.establishments || []).map((e) => ({ value: e.id, label: e.name }))}
                  />
                  <TextInput label="Domaine" value={editing.field || ''} onChange={(e) => setEditing({ ...editing, field: e.target.value })} placeholder="Informatique, commerce, santé…" />
                  <TextInput
                    label="Durée (années)"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={editing.duration_years}
                    onChange={(e) => setEditing({ ...editing, duration_years: e.target.value })}
                  />
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!editing.internship_required}
                    onChange={(e) => setEditing({ ...editing, internship_required: e.target.checked })}
                  />
                  <span>Un stage ou une période en entreprise est obligatoire</span>
                </label>
              </>
            )}

            {editing.__type === 'cohorts' && (
              <>
                <Select
                  label="Formation"
                  required
                  empty="— Choisir —"
                  value={editing.program_id || ''}
                  onChange={(e) => setEditing({ ...editing, program_id: e.target.value })}
                  options={(data.programs || []).map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${establishmentName(p.establishment_id)}`,
                  }))}
                />
                <TextInput label="Libellé" required value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="1re année 2025-2026" />
                <div className="grid grid--3">
                  <TextInput label="Année de formation" type="number" min="1" max="10" value={editing.year_level} onChange={(e) => setEditing({ ...editing, year_level: e.target.value })} />
                  <TextInput label="Année de début" type="number" value={editing.start_year || ''} onChange={(e) => setEditing({ ...editing, start_year: e.target.value })} />
                  <TextInput label="Année de fin" type="number" value={editing.end_year || ''} onChange={(e) => setEditing({ ...editing, end_year: e.target.value })} />
                </div>
              </>
            )}

            <label className="checkbox">
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              <span>Visible dans les listes de sélection</span>
            </label>

            <button className="btn btn--marker" type="submit">
              Enregistrer
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
