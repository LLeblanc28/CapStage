import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { del, get, post } from '../api.js';
import { ConfirmButton, Empty, ErrorAlert, Loading } from '../components/ui.jsx';
import { TEMPLATE_LABELS, VISIBILITY_SHORT, formatDate } from '../labels.js';

export default function CvList() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = () => get('/cvs').then((d) => setItems(d.items)).catch(setError);
  useEffect(() => {
    load();
  }, []);

  async function createCv() {
    try {
      const data = await post('/cvs', { title: 'Nouveau CV', template: 'classique' });
      navigate(`/cv/${data.cv.id}`);
    } catch (err) {
      setError(err);
    }
  }

  if (error) return <ErrorAlert error={error} onClose={() => setError(null)} />;
  if (!items) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes CV</h1>
          <p>
            Créez un CV par type de recherche : un CV « développement », un CV « support », un CV en
            anglais… Chacun s’exporte séparément.
          </p>
        </div>
        <button className="btn btn--marker" type="button" onClick={createCv}>
          Nouveau CV
        </button>
      </div>

      {items.length === 0 ? (
        <Empty
          title="Aucun CV pour le moment"
          action={
            <button className="btn btn--marker" type="button" onClick={createCv}>
              Créer mon premier CV
            </button>
          }
        >
          Vous remplissez des formulaires, la plateforme se charge de la mise en page.
        </Empty>
      ) : (
        <div className="grid grid--2">
          {items.map((cv) => (
            <article key={cv.id} className="sheet" style={{ borderLeft: `4px solid ${cv.accent}` }}>
              <div className="sheet__head">
                <div>
                  <h2>{cv.title}</h2>
                  <p className="small muted" style={{ margin: 0 }}>
                    {cv.headline || 'Sans accroche'}
                  </p>
                </div>
                {cv.is_default ? <span className="badge badge--marker">CV principal</span> : null}
              </div>

              <div className="row small muted">
                <span className="badge">{TEMPLATE_LABELS[cv.template]}</span>
                <span className="badge">{VISIBILITY_SHORT[cv.visibility]}</span>
                <span className="mono">{cv.experience_count} exp.</span>
                <span className="mono">{cv.skill_count} comp.</span>
                <span className="mono">{cv.pdf_exports} PDF</span>
              </div>

              <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
                Modifié le {formatDate(cv.updated_at)}
              </p>

              <div className="divider" />
              <div className="row">
                <Link className="btn btn--sm" to={`/cv/${cv.id}`}>
                  Modifier
                </Link>
                <Link className="btn btn--ghost btn--sm" to={`/cv/${cv.id}/apercu`}>
                  Aperçu et PDF
                </Link>
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => post(`/cvs/${cv.id}/duplicate`).then(load).catch(setError)}
                >
                  Dupliquer
                </button>
                {!cv.is_default && (
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() => post(`/cvs/${cv.id}/default`).then(load).catch(setError)}
                  >
                    Définir comme principal
                  </button>
                )}
                <span className="spacer" />
                <ConfirmButton
                  question="Supprimer définitivement ?"
                  onConfirm={() => del(`/cvs/${cv.id}`).then(load).catch(setError)}
                >
                  Supprimer
                </ConfirmButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
