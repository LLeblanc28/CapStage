import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CvList from './pages/CvList.jsx';
import CvEditor from './pages/CvEditor.jsx';
import CvView from './pages/CvView.jsx';
import Directory from './pages/Directory.jsx';
import Applications from './pages/Applications.jsx';
import Profile from './pages/Profile.jsx';
import Help from './pages/Help.jsx';
import TutorStudents from './pages/TutorStudents.jsx';
import TutorStudent from './pages/TutorStudent.jsx';
import AdminStats from './pages/AdminStats.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminReferentiel from './pages/AdminReferentiel.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="main muted">Chargement…</p>;
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="main">
        <div className="alert alert--error">Cette page est réservée à un autre profil.</div>
      </div>
    );
  }
  return children;
}

function Home() {
  const { user } = useAuth();
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'tutor') return <Navigate to="/suivi" replace />;
  return <Dashboard />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/connexion"
        element={loading ? <p className="main muted">Chargement…</p> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/inscription"
        element={loading ? <p className="main muted">Chargement…</p> : user ? <Navigate to="/" replace /> : <Register />}
      />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/cv" element={<CvList />} />
        <Route path="/cv/:id" element={<CvEditor />} />
        <Route path="/cv/:id/apercu" element={<CvView />} />
        <Route path="/candidatures" element={<Applications />} />
        <Route path="/annuaire" element={<Directory />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/aide" element={<Help />} />

        <Route
          path="/suivi"
          element={
            <Protected roles={['tutor', 'admin']}>
              <TutorStudents />
            </Protected>
          }
        />
        <Route
          path="/suivi/:id"
          element={
            <Protected roles={['tutor', 'admin']}>
              <TutorStudent />
            </Protected>
          }
        />

        <Route
          path="/admin"
          element={
            <Protected roles={['admin']}>
              <AdminStats />
            </Protected>
          }
        />
        <Route
          path="/admin/comptes"
          element={
            <Protected roles={['admin']}>
              <AdminUsers />
            </Protected>
          }
        />
        <Route
          path="/admin/referentiel"
          element={
            <Protected roles={['admin']}>
              <AdminReferentiel />
            </Protected>
          }
        />

        <Route path="*" element={<div className="alert alert--info">Page introuvable.</div>} />
      </Route>
    </Routes>
  );
}
