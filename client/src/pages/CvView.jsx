import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api.js';
import CvPreview from '../components/CvPreview.jsx';
import { ErrorAlert, Loading } from '../components/ui.jsx';
import { LEVEL_LABELS, SEARCH_KIND_LABELS, TEMPLATE_LABELS, VISIBILITY_SHORT, formatDate } from '../labels.js';

export default function CvView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    get(`/cvs/${id}`)
      .then((d) => {
        setData(d);
        setTemplate(d.cv.template);
      })
      .catch(setError);
  }, [id]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const { cv, editable } = data;
  const shown = { ...cv, template };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Aperçu</span>
          <h1>
            {cv.first_name} {cv.last_name}
          </h1>
          <p>
            {[cv.program_name && `${cv.program_name} (${LEVEL_LABELS[cv.program_level] || cv.program_level})`, cv.cohort_label, cv.establishment_name]
              .filter(Boolean)
              .join(' · ') || 'Formation non renseignée'}
          </p>
        </div>
        <div className="row">
          {editable && (
            <Link className="btn btn--ghost" to={`/cv/${id}`}>
              Modifier
            </Link>
          )}
          <a className="btn btn--marker" href={`/api/cvs/${id}/pdf?template=${template}`}>
            Télécharger le PDF
          </a>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', alignItems: 'start' }}>
        <aside className="sheet">
          <h3>Ce CV</h3>
          <ul className="list-reset small" style={{ display: 'grid', gap: '0.4rem' }}>
            <li>
              <span className="eyebrow">Titre</span>
              <div>{cv.title}</div>
            </li>
            <li>
              <span className="eyebrow">Visibilité</span>
              <div>{VISIBILITY_SHORT[cv.visibility]}</div>
            </li>
            <li>
              <span className="eyebrow">Recherche</span>
              <div>
                {cv.searching ? SEARCH_KIND_LABELS[cv.search_kind] : 'Pas en recherche'}
                {cv.available_from ? ` — dès le ${formatDate(cv.available_from)}` : ''}
              </div>
            </li>
            <li>
              <span className="eyebrow">Mis à jour</span>
              <div>{formatDate(cv.updated_at)}</div>
            </li>
            <li>
              <span className="eyebrow">Exports PDF</span>
              <div className="mono">{cv.pdf_exports}</div>
            </li>
          </ul>

          <div className="divider" />
          <span className="eyebrow">Essayer un autre modèle</span>
          <div className="row row--tight" style={{ marginTop: '0.4rem' }}>
            {Object.entries(TEMPLATE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={template === value ? 'btn btn--sm' : 'btn btn--ghost btn--sm'}
                onClick={() => setTemplate(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: '0.6rem' }}>
            Le modèle choisi ici s’applique au PDF téléchargé. Pour l’enregistrer durablement, modifiez
            le CV.
          </p>
        </aside>

        <CvPreview cv={shown} />
      </div>
    </>
  );
}
