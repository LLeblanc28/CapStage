import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, query } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorAlert, Select, TextInput } from '../components/ui.jsx';
import { LEVEL_LABELS } from '../labels.js';
import { Pitch } from './Login.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [establishments, setEstablishments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    establishment_id: '',
    cohort_id: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/referentiel/establishments').then((d) => setEstablishments(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.establishment_id) {
      setCohorts([]);
      return;
    }
    get(`/referentiel/cohorts${query({ establishment_id: form.establishment_id })}`)
      .then((d) => setCohorts(d.items))
      .catch(() => setCohorts([]));
  }, [form.establishment_id]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <Pitch />
      <div className="gate__form">
        <h2 style={{ marginBottom: '0.25rem' }}>Créer un compte</h2>
        <p className="muted small">
          Votre établissement n’apparaît pas dans la liste ? Laissez le champ vide, un administrateur
          vous rattachera ensuite.
        </p>
        <ErrorAlert error={error} />
        <form onSubmit={onSubmit}>
          <div className="grid grid--2">
            <TextInput label="Prénom" name="first_name" required value={form.first_name} onChange={update('first_name')} />
            <TextInput label="Nom" name="last_name" required value={form.last_name} onChange={update('last_name')} />
          </div>
          <TextInput
            label="Adresse e-mail"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={form.email}
            onChange={update('email')}
          />
          <TextInput
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={update('password')}
            hint="12 caractères minimum recommandés, avec majuscule, minuscule et chiffre."
          />
          <div className="grid grid--2">
            <TextInput label="Téléphone" name="phone" value={form.phone} onChange={update('phone')} />
            <TextInput label="Ville" name="city" value={form.city} onChange={update('city')} />
          </div>
          <Select
            label="Établissement"
            name="establishment_id"
            empty="— Aucun pour le moment —"
            value={form.establishment_id}
            onChange={(e) => setForm((f) => ({ ...f, establishment_id: e.target.value, cohort_id: '' }))}
            options={establishments.map((e) => ({ value: e.id, label: `${e.name}${e.city ? ` (${e.city})` : ''}` }))}
          />
          {cohorts.length > 0 && (
            <Select
              label="Formation et promotion"
              name="cohort_id"
              empty="— À préciser plus tard —"
              value={form.cohort_id}
              onChange={update('cohort_id')}
              options={cohorts.map((c) => ({
                value: c.id,
                label: `${c.program_name} (${LEVEL_LABELS[c.program_level] || c.program_level}) — ${c.label}`,
              }))}
            />
          )}
          <button className="btn btn--marker" type="submit" disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
