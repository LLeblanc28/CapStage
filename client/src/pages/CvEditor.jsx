import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, put, uploadPhoto, del } from '../api.js';
import CvPreview from '../components/CvPreview.jsx';
import { Checkbox, ErrorAlert, Loading, Notice, Select, TextArea, TextInput } from '../components/ui.jsx';
import {
  EXPERIENCE_KIND_LABELS,
  LANGUAGE_LEVEL_LABELS,
  SEARCH_KIND_LABELS,
  SKILL_CATEGORY_LABELS,
  TEMPLATE_HINTS,
  TEMPLATE_LABELS,
  VISIBILITY_LABELS,
} from '../labels.js';

const TABS = [
  { key: 'identite', label: 'Identité et projet' },
  { key: 'parcours', label: 'Parcours' },
  { key: 'competences', label: 'Compétences' },
  { key: 'diffusion', label: 'Mise en forme et diffusion' },
];

const optionsFrom = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

/** Liste d'éléments répétables (expériences, compétences…). */
function RepeatList({ label, items, onChange, blank, addLabel, children }) {
  const update = (index, patch) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div className="sheet__head">
        <h3>{label}</h3>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => onChange([...items, { ...blank }])}>
          {addLabel}
        </button>
      </div>
      {items.length === 0 && <p className="small muted">Aucun élément pour l’instant.</p>}
      {items.map((item, index) => (
        <div className="item" key={index}>
          <div className="item__head">
            <span className="item__index">{String(index + 1).padStart(2, '0')}</span>
            <span className="row row--tight">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter">
                ↑
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Descendre"
              >
                ↓
              </button>
              <button className="btn btn--danger btn--sm" type="button" onClick={() => remove(index)}>
                Retirer
              </button>
            </span>
          </div>
          {children(item, (patch) => update(index, patch))}
        </div>
      ))}
    </section>
  );
}

export default function CvEditor() {
  const { id } = useParams();
  const [cv, setCv] = useState(null);
  const [tab, setTab] = useState('identite');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    get(`/cvs/${id}`)
      .then((d) => setCv(d.cv))
      .catch(setError);
  }, [id]);

  const set = useCallback((patch) => {
    setCv((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    if (!cv) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...cv,
        experiences: cv.experiences,
        educations: cv.educations,
        skills: cv.skills,
        languages: cv.languages,
        certifications: cv.certifications,
        interests: cv.interests,
        links: cv.links,
      };
      const data = await put(`/cvs/${id}`, payload);
      setCv(data.cv);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [cv, id]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  useEffect(() => {
    const warn = (e) => {
      if (!dirty) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const previewCv = useMemo(() => cv, [cv]);

  if (error && !cv) return <ErrorAlert error={error} />;
  if (!cv) return <Loading />;

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadPhoto(id, file);
      setCv((c) => ({ ...c, photo_path: data.photo_path }));
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Éditeur de CV</span>
          <h1>{cv.title}</h1>
          <p>Tout ce que vous saisissez est repris tel quel dans le PDF. Rien à mettre en page.</p>
        </div>
        <div className="row">
          <Link className="btn btn--ghost" to={`/cv/${id}/apercu`}>
            Aperçu et PDF
          </Link>
          <button className="btn btn--marker" type="button" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'Enregistré'}
          </button>
        </div>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />
      {saved && <Notice tone="ok">Modifications enregistrées.</Notice>}

      <div className="row no-print" style={{ marginBottom: '1rem' }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'btn btn--sm' : 'btn btn--ghost btn--sm'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)', alignItems: 'start' }}>
        <div className="sheet sheet--ruled">
          {tab === 'identite' && (
            <>
              <TextInput
                label="Titre interne du CV"
                value={cv.title}
                onChange={(e) => set({ title: e.target.value })}
                hint="Sert uniquement à vous repérer dans la liste. Il n’apparaît pas sur le PDF."
              />
              <TextInput
                label="Accroche"
                value={cv.headline || ''}
                onChange={(e) => set({ headline: e.target.value })}
                hint="Une ligne : formation en cours et poste recherché."
              />
              <TextArea
                label="Profil"
                value={cv.summary || ''}
                onChange={(e) => set({ summary: e.target.value })}
                hint="Trois à quatre phrases : ce que vous savez faire, ce que vous cherchez, pour quelle durée."
              />
              <div className="grid grid--2">
                <TextInput label="E-mail affiché" type="email" value={cv.contact_email || ''} onChange={(e) => set({ contact_email: e.target.value })} />
                <TextInput label="Téléphone" value={cv.contact_phone || ''} onChange={(e) => set({ contact_phone: e.target.value })} />
                <TextInput label="Ville" value={cv.contact_city || ''} onChange={(e) => set({ contact_city: e.target.value })} />
                <TextInput label="Date de naissance" type="date" value={cv.birthdate || ''} onChange={(e) => set({ birthdate: e.target.value })} />
                <TextInput label="Permis" value={cv.driving_license || ''} onChange={(e) => set({ driving_license: e.target.value })} hint="Exemple : Permis B, véhicule personnel" />
                <TextInput label="Mobilité" value={cv.mobility || ''} onChange={(e) => set({ mobility: e.target.value })} hint="Exemple : mobile sur toute la région" />
              </div>

              <div className="divider" />
              <h3>Photo</h3>
              <p className="small muted">
                Facultative. Elle apparaît sur les modèles Classique et Moderne. JPEG ou PNG, 1,5 Mo maximum.
              </p>
              <div className="row">
                <input ref={fileInput} type="file" accept="image/jpeg,image/png" onChange={onPhoto} />
                {cv.photo_path && (
                  <button
                    className="btn btn--danger btn--sm"
                    type="button"
                    onClick={() =>
                      del(`/cvs/${id}/photo`)
                        .then(() => setCv((c) => ({ ...c, photo_path: null })))
                        .catch(setError)
                    }
                  >
                    Retirer la photo
                  </button>
                )}
              </div>

              <div className="divider" />
              <RepeatList
                label="Liens"
                items={cv.links}
                onChange={(links) => set({ links })}
                blank={{ label: '', url: '' }}
                addLabel="Ajouter un lien"
              >
                {(item, patch) => (
                  <div className="grid grid--2">
                    <TextInput label="Intitulé" value={item.label} onChange={(e) => patch({ label: e.target.value })} placeholder="GitHub, portfolio, LinkedIn" />
                    <TextInput label="Adresse" value={item.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" />
                  </div>
                )}
              </RepeatList>
            </>
          )}

          {tab === 'parcours' && (
            <>
              <RepeatList
                label="Expériences, stages et projets"
                items={cv.experiences}
                onChange={(experiences) => set({ experiences })}
                blank={{ kind: 'stage', position: '', organisation: '', city: '', start_date: '', end_date: '', current: 0, description: '' }}
                addLabel="Ajouter une expérience"
              >
                {(item, patch) => (
                  <>
                    <div className="grid grid--2">
                      <TextInput label="Intitulé du poste ou du projet" value={item.position} onChange={(e) => patch({ position: e.target.value })} />
                      <Select
                        label="Type"
                        value={item.kind}
                        onChange={(e) => patch({ kind: e.target.value })}
                        options={optionsFrom(EXPERIENCE_KIND_LABELS)}
                      />
                      <TextInput label="Organisation" value={item.organisation || ''} onChange={(e) => patch({ organisation: e.target.value })} />
                      <TextInput label="Ville" value={item.city || ''} onChange={(e) => patch({ city: e.target.value })} />
                      <TextInput label="Début" type="date" value={item.start_date || ''} onChange={(e) => patch({ start_date: e.target.value })} />
                      <TextInput label="Fin" type="date" value={item.end_date || ''} onChange={(e) => patch({ end_date: e.target.value })} disabled={!!item.current} />
                    </div>
                    <Checkbox label="En cours" checked={!!item.current} onChange={(e) => patch({ current: e.target.checked ? 1 : 0 })} />
                    <TextArea
                      label="Missions"
                      value={item.description || ''}
                      onChange={(e) => patch({ description: e.target.value })}
                      hint="Une ligne par mission, commencée par un tiret. Chaque tiret devient une puce dans le PDF."
                    />
                  </>
                )}
              </RepeatList>

              <RepeatList
                label="Formation"
                items={cv.educations}
                onChange={(educations) => set({ educations })}
                blank={{ degree: '', school: '', city: '', start_date: '', end_date: '', current: 0, description: '' }}
                addLabel="Ajouter une formation"
              >
                {(item, patch) => (
                  <>
                    <div className="grid grid--2">
                      <TextInput label="Diplôme ou formation" value={item.degree} onChange={(e) => patch({ degree: e.target.value })} />
                      <TextInput label="Établissement" value={item.school || ''} onChange={(e) => patch({ school: e.target.value })} />
                      <TextInput label="Ville" value={item.city || ''} onChange={(e) => patch({ city: e.target.value })} />
                      <TextInput label="Début" type="date" value={item.start_date || ''} onChange={(e) => patch({ start_date: e.target.value })} />
                      <TextInput label="Fin" type="date" value={item.end_date || ''} onChange={(e) => patch({ end_date: e.target.value })} disabled={!!item.current} />
                    </div>
                    <Checkbox label="En cours" checked={!!item.current} onChange={(e) => patch({ current: e.target.checked ? 1 : 0 })} />
                    <TextArea label="Précisions" value={item.description || ''} onChange={(e) => patch({ description: e.target.value })} hint="Options, spécialités, mention." />
                  </>
                )}
              </RepeatList>

              <RepeatList
                label="Certifications"
                items={cv.certifications}
                onChange={(certifications) => set({ certifications })}
                blank={{ name: '', issuer: '', obtained_at: '', url: '' }}
                addLabel="Ajouter une certification"
              >
                {(item, patch) => (
                  <div className="grid grid--2">
                    <TextInput label="Intitulé" value={item.name} onChange={(e) => patch({ name: e.target.value })} placeholder="PIX, TOEIC, habilitation…" />
                    <TextInput label="Organisme" value={item.issuer || ''} onChange={(e) => patch({ issuer: e.target.value })} />
                    <TextInput label="Obtenue le" type="date" value={item.obtained_at || ''} onChange={(e) => patch({ obtained_at: e.target.value })} />
                    <TextInput label="Lien" value={item.url || ''} onChange={(e) => patch({ url: e.target.value })} />
                  </div>
                )}
              </RepeatList>
            </>
          )}

          {tab === 'competences' && (
            <>
              <RepeatList
                label="Compétences"
                items={cv.skills}
                onChange={(skills) => set({ skills })}
                blank={{ name: '', category: 'technique', level: 3 }}
                addLabel="Ajouter une compétence"
              >
                {(item, patch) => (
                  <div className="grid grid--3">
                    <TextInput label="Compétence" value={item.name} onChange={(e) => patch({ name: e.target.value })} />
                    <Select label="Catégorie" value={item.category} onChange={(e) => patch({ category: e.target.value })} options={optionsFrom(SKILL_CATEGORY_LABELS)} />
                    <Select
                      label="Niveau"
                      value={item.level}
                      onChange={(e) => patch({ level: Number(e.target.value) })}
                      options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${'●'.repeat(n)}${'○'.repeat(5 - n)}` }))}
                    />
                  </div>
                )}
              </RepeatList>

              <RepeatList
                label="Langues"
                items={cv.languages}
                onChange={(languages) => set({ languages })}
                blank={{ name: '', level: 'B1' }}
                addLabel="Ajouter une langue"
              >
                {(item, patch) => (
                  <div className="grid grid--2">
                    <TextInput label="Langue" value={item.name} onChange={(e) => patch({ name: e.target.value })} />
                    <Select label="Niveau" value={item.level} onChange={(e) => patch({ level: e.target.value })} options={optionsFrom(LANGUAGE_LEVEL_LABELS)} />
                  </div>
                )}
              </RepeatList>

              <RepeatList
                label="Centres d’intérêt"
                items={cv.interests}
                onChange={(interests) => set({ interests })}
                blank={{ label: '' }}
                addLabel="Ajouter un centre d’intérêt"
              >
                {(item, patch) => (
                  <TextInput label="Intitulé" value={item.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Volley-ball en club, photographie…" />
                )}
              </RepeatList>
            </>
          )}

          {tab === 'diffusion' && (
            <>
              <h3>Modèle</h3>
              <div className="grid grid--3" style={{ marginBottom: '1rem' }}>
                {Object.entries(TEMPLATE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="item"
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: cv.template === value ? 'var(--ink)' : 'var(--rule)',
                      borderWidth: cv.template === value ? 2 : 1,
                      background: cv.template === value ? '#fff' : '#fbfcfe',
                      font: 'inherit',
                    }}
                    onClick={() => set({ template: value })}
                    aria-pressed={cv.template === value}
                  >
                    <strong>{label}</strong>
                    <div className="small muted">{TEMPLATE_HINTS[value]}</div>
                  </button>
                ))}
              </div>

              <div className="field">
                <label htmlFor="accent">Couleur d’accent</label>
                <div className="row">
                  <input id="accent" type="color" value={cv.accent} onChange={(e) => set({ accent: e.target.value })} />
                  <span className="mono small">{cv.accent}</span>
                </div>
              </div>

              <div className="divider" />
              <h3>Diffusion</h3>
              <Select
                label="Qui peut consulter ce CV dans l’annuaire"
                value={cv.visibility}
                onChange={(e) => set({ visibility: e.target.value })}
                options={optionsFrom(VISIBILITY_LABELS)}
              />
              <Checkbox
                label="Je suis en recherche active"
                checked={!!cv.searching}
                onChange={(e) => set({ searching: e.target.checked ? 1 : 0 })}
              />
              <div className="grid grid--2">
                <Select
                  label="Type de recherche"
                  value={cv.search_kind}
                  onChange={(e) => set({ search_kind: e.target.value })}
                  options={optionsFrom(SEARCH_KIND_LABELS)}
                />
                <TextInput
                  label="Disponible à partir du"
                  type="date"
                  value={cv.available_from || ''}
                  onChange={(e) => set({ available_from: e.target.value })}
                />
              </div>
              <Checkbox
                label="Utiliser ce CV comme CV principal"
                checked={!!cv.is_default}
                onChange={(e) => set({ is_default: e.target.checked ? 1 : 0 })}
              />
            </>
          )}
        </div>

        <div style={{ position: 'sticky', top: '1rem' }}>
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <span className="eyebrow">Aperçu — modèle {TEMPLATE_LABELS[cv.template]}</span>
            <span className="spacer" />
            {dirty && <span className="badge badge--warn">Non enregistré</span>}
          </div>
          <CvPreview cv={previewCv} />
        </div>
      </div>
    </>
  );
}
