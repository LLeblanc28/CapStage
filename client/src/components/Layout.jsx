import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ROLE_LABELS } from '../labels.js';

const STUDENT_LINKS = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/cv', label: 'Mes CV' },
  { to: '/candidatures', label: 'Ma recherche' },
  { to: '/annuaire', label: 'Annuaire des CV' },
];

const TUTOR_LINKS = [
  { to: '/suivi', label: 'Étudiants suivis' },
  { to: '/annuaire', label: 'Annuaire des CV' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Statistiques', end: true },
  { to: '/admin/comptes', label: 'Comptes' },
  { to: '/admin/referentiel', label: 'Établissements et formations' },
];

export default function Layout() {
  const { user, platform, logout } = useAuth();
  const navigate = useNavigate();

  const groups = [];
  if (user.role === 'student') groups.push({ title: 'Ma recherche', links: STUDENT_LINKS });
  if (user.role === 'tutor') {
    groups.push({ title: 'Suivi pédagogique', links: TUTOR_LINKS });
  }
  if (user.role === 'admin') {
    groups.push({ title: 'Pilotage', links: [...ADMIN_LINKS] });
    groups.push({ title: 'Suivi pédagogique', links: TUTOR_LINKS });
    groups.push({ title: 'Mes documents', links: [{ to: '/cv', label: 'Mes CV' }] });
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Navigation principale">
        <NavLink to="/" className="rail__brand">
          Cap<span>Stage</span>
        </NavLink>

        {groups.map((group) => (
          <div className="rail__group" key={group.title}>
            <span className="eyebrow">{group.title}</span>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'nav is-active' : 'nav')}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="rail__group">
          <span className="eyebrow">Mon compte</span>
          <NavLink to="/profil" className={({ isActive }) => (isActive ? 'nav is-active' : 'nav')}>
            Profil et mot de passe
          </NavLink>
          <NavLink to="/aide" className={({ isActive }) => (isActive ? 'nav is-active' : 'nav')}>
            Aide
          </NavLink>
        </div>

        <div className="rail__user">
          <strong>
            {user.first_name} {user.last_name}
          </strong>
          <span className="small">{ROLE_LABELS[user.role]}</span>
          {user.establishment_name && <div className="small">{user.establishment_name}</div>}
          <button
            type="button"
            className="nav"
            style={{ marginTop: '0.5rem', paddingLeft: 0 }}
            onClick={async () => {
              await logout();
              navigate('/connexion');
            }}
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      <main className="main">
        <p className="eyebrow no-print" style={{ marginBottom: '0.75rem' }}>
          {platform} · {user.establishment_name || 'Sans établissement'}
        </p>
        <Outlet />
      </main>
    </div>
  );
}
