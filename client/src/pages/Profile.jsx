import { useEffect, useState } from 'react';
import { get, put, query } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorAlert, Notice, Select, TextInput } from '../components/ui.jsx';
import { LEVEL_LABELS, ROLE_LABELS } from '../labels.js';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone || '',
    city: user.city || '',
    birthdate: user.birthdate || '',
    establishment_id: user.establishment_id || '',
    cohort_id: user.cohort_id || '',
  });
  const [establishments, setEstablishments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

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

  async function saveProfile(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await updateProfile(form);
      setMessage('Profil enregistré.');
    } catch (err) {
      setError(err);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await put('/auth/password', passwords);
      setPasswords({ current_password: '', new_password: '' });
      setMessage('Mot de passe modifié.');
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mon profil</h1>
          <p>
            Ces informations servent au rattachement pédagogique. Les coordonnées affichées sur le CV
            se règlent, elles, dans l’éditeur de CV.
          </p>
        </div>
        <span className="badge">{ROLE_LABELS[user.role]}</span>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />
      {message && <Notice tone="ok">{message}</Notice>}

      <div className="grid grid--2">
        <form className="sheet sheet--ruled" onSubmit={saveProfile}>
          <h2>Identité et rattachement</h2>
          <div className="grid grid--2">
            <TextInput label="Prénom" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <TextInput label="Nom" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <TextInput label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextInput label="Ville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextInput label="Date de naissance" type="date" value={form.birthdate || ''} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
          </div>
          <Select
            label="Établissement"
            empty="— Aucun —"
            value={form.establishment_id}
            onChange={(e) => setForm({ ...form, establishment_id: e.target.value, cohort_id: '' })}
            options={establishments.map((e) => ({ value: e.id, label: e.name }))}
          />
          <Select
            label="Formation et promotion"
            empty="— Aucune —"
            value={form.cohort_id}
            onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}
            options={cohorts.map((c) => ({
              value: c.id,
              label: `${c.program_name} (${LEVEL_LABELS[c.program_level] || c.program_level}) — ${c.label}`,
            }))}
          />
          <button className="btn btn--marker" type="submit">
            Enregistrer le profil
          </button>
        </form>

        <form className="sheet sheet--ruled" onSubmit={savePassword}>
          <h2>Mot de passe</h2>
          <p className="small muted">
            10 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.
          </p>
          <TextInput
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            required
            value={passwords.current_password}
            onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
          />
          <TextInput
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            required
            value={passwords.new_password}
            onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
          />
          <button className="btn" type="submit">
            Modifier le mot de passe
          </button>

          <div className="divider" />
          <h3>Vos données</h3>
          <p className="small muted">
            Compte créé le {user.created_at?.slice(0, 10)}. Pour supprimer votre compte et vos CV,
            adressez la demande à l’administrateur de votre établissement.
          </p>
        </form>
      </div>
    </>
  );
}
