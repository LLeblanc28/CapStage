import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorAlert, TextInput } from '../components/ui.jsx';

export function Pitch() {
  return (
    <aside className="gate__pitch">
      <span className="eyebrow" style={{ color: '#8ea0ba' }}>
        Plateforme de CV et de suivi de recherche
      </span>
      <h1>
        Un CV <span className="marker">propre</span>, à jour, prêt à envoyer.
      </h1>
      <p className="small" style={{ maxWidth: '46ch', color: '#b9c5d6' }}>
        CapStage s’adresse à tous les apprenants qui doivent trouver un stage, une alternance ou un
        premier emploi : lycée, CAP, bac pro, BTS, BUT, licence, master, CFA ou organisme de formation.
      </p>
      <ul>
        <li>
          <span className="mono">01</span>
          <span>Remplissez votre profil section par section, sans mise en page à gérer.</span>
        </li>
        <li>
          <span className="mono">02</span>
          <span>Choisissez un modèle, exportez le PDF, recommencez autant de fois que nécessaire.</span>
        </li>
        <li>
          <span className="mono">03</span>
          <span>Notez vos candidatures : votre référent voit où vous en êtes et vous accompagne.</span>
        </li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
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
        <h2 style={{ marginBottom: '0.25rem' }}>Se connecter</h2>
        <p className="muted small">Utilisez l’adresse e-mail fournie par votre établissement.</p>
        <ErrorAlert error={error} />
        <form onSubmit={onSubmit}>
          <TextInput
            label="Adresse e-mail"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextInput
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn--marker" type="submit" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          Pas encore de compte ? <Link to="/inscription">Créer un compte étudiant</Link>
        </p>
        <p className="small muted">
          Mot de passe oublié : contactez l’administrateur de votre établissement, qui peut le
          réinitialiser depuis la plateforme.
        </p>
      </div>
    </div>
  );
}
