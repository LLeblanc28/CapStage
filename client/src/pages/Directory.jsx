import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, query } from '../api.js';
import { Empty, ErrorAlert, Loading, Select, TextInput } from '../components/ui.jsx';
import { LEVEL_LABELS, SEARCH_KIND_LABELS, formatDate } from '../labels.js';

const EMPTY_FILTERS = {
  q: '',
  establishment_id: '',
  program_id: '',
  level: '',
  search_kind: '',
  city: '',
  skill: '',
  searching: false,
  sort: 'recent',
};

export default function Directory() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    get('/referentiel/establishments').then((d) => setEstablishments(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    get(`/referentiel/programs${query({ establishment_id: filters.establishment_id })}`)
      .then((d) => setPrograms(d.items))
      .catch(() => setPrograms([]));
  }, [filters.establishment_id]);

  useEffect(() => {
    const handle = setTimeout(() => {
      get(`/directory${query({ ...filters, page, per_page: 12 })}`)
        .then(setData)
        .catch(setError);
    }, 250);
    return () => clearTimeout(handle);
  }, [filters, page]);

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'establishment_id' ? { program_id: '' } : {}) }));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Annuaire des CV</h1>
          <p>
            Tous les CV que leurs auteurs ont accepté de partager. Filtrez par formation, niveau,
            compétence ou ville — utile pour comparer, s’inspirer, ou repérer un profil.
          </p>
        </div>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <section className="sheet" style={{ marginBottom: '1.25rem' }}>
        <div className="grid grid--3">
          <TextInput label="Recherche libre" type="search" value={filters.q} onChange={update('q')} placeholder="Nom, accroche, entreprise…" />
          <TextInput label="Compétence" type="search" value={filters.skill} onChange={update('skill')} placeholder="Python, soudure, anglais…" />
          <TextInput label="Ville" type="search" value={filters.city} onChange={update('city')} />
          <Select
            label="Établissement"
            empty="Tous"
            value={filters.establishment_id}
            onChange={update('establishment_id')}
            options={establishments.map((e) => ({ value: e.id, label: e.name }))}
          />
          <Select
            label="Formation"
            empty="Toutes"
            value={filters.program_id}
            onChange={update('program_id')}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="Niveau"
            empty="Tous"
            value={filters.level}
            onChange={update('level')}
            options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Type de recherche"
            empty="Tous"
            value={filters.search_kind}
            onChange={update('search_kind')}
            options={Object.entries(SEARCH_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Trier par"
            value={filters.sort}
            onChange={update('sort')}
            options={[
              { value: 'recent', label: 'Mise à jour récente' },
              { value: 'name', label: 'Nom' },
              { value: 'views', label: 'Consultations' },
            ]}
          />
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="checkbox">
              <input type="checkbox" checked={filters.searching} onChange={update('searching')} />
              <span>Uniquement les profils en recherche active</span>
            </label>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      </section>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="Aucun CV ne correspond">Élargissez la recherche ou retirez un filtre.</Empty>
      ) : (
        <>
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>
            {data.total} CV — page {data.page} sur {data.pages}
          </p>
          <div className="grid grid--3">
            {data.items.map((cv) => (
              <article key={cv.id} className="cv-card" style={{ '--accent': cv.accent }}>
                <div>
                  <h3>
                    {cv.first_name} {cv.last_name}
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {cv.headline || cv.title}
                  </p>
                </div>
                <div className="small muted">
                  {[cv.program_name, cv.cohort_label].filter(Boolean).join(' — ') || 'Formation non renseignée'}
                  {cv.establishment_name && <div>{cv.establishment_name}</div>}
                </div>
                {cv.skills.length > 0 && (
                  <div className="chips">
                    {cv.skills.map((s) => (
                      <span className="chip" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="row small">
                  {cv.searching ? (
                    <span className="badge badge--marker">{SEARCH_KIND_LABELS[cv.search_kind]}</span>
                  ) : (
                    <span className="badge">Pas en recherche</span>
                  )}
                  {cv.contact_city && <span className="badge">{cv.contact_city}</span>}
                </div>
                <div className="row">
                  <Link className="btn btn--ghost btn--sm" to={`/cv/${cv.id}/apercu`}>
                    Consulter
                  </Link>
                  <a className="btn btn--ghost btn--sm" href={`/api/cvs/${cv.id}/pdf`}>
                    PDF
                  </a>
                  <span className="spacer" />
                  <span className="small muted">{formatDate(cv.updated_at)}</span>
                </div>
              </article>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="row" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
              <button className="btn btn--ghost btn--sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Page précédente
              </button>
              <span className="mono small">
                {data.page} / {data.pages}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Page suivante
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
