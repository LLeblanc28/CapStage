import { useAuth } from '../auth.jsx';

const STUDENT_STEPS = [
  {
    title: 'Remplir le CV',
    body: "Onglet « Mes CV » → Modifier. Renseignez l'accroche, le profil, puis vos expériences et formations. Dans les missions, commencez chaque ligne par un tiret : elle devient une puce dans le PDF.",
  },
  {
    title: 'Choisir un modèle',
    body: "Onglet « Mise en forme et diffusion ». Classique convient à toutes les candidatures, Moderne met le profil en avant, Compact fait tenir un parcours dense sur une page.",
  },
  {
    title: 'Exporter le PDF',
    body: "Bouton « Aperçu et PDF », puis « Télécharger le PDF ». Vous pouvez tester un autre modèle avant de télécharger, sans modifier votre CV.",
  },
  {
    title: 'Enregistrer chaque démarche',
    body: "Onglet « Ma recherche ». Une ligne par candidature, y compris les spontanées et les relances. Mettez le statut à jour : c'est ce que votre référent consulte.",
  },
  {
    title: 'Régler la visibilité',
    body: "Privé, Établissement ou Ouvert. Un CV privé reste visible par vous et votre référent uniquement ; il n'apparaît pas dans l'annuaire.",
  },
];

const TUTOR_STEPS = [
  {
    title: 'Suivre une promotion',
    body: "« Étudiants suivis » liste vos étudiants avec le nombre de candidatures, d'entretiens et de réponses positives. La colonne CV signale ceux qui n'ont encore rien saisi.",
  },
  {
    title: 'Consulter un dossier',
    body: "Cliquez sur un étudiant : vous voyez ses CV, ses candidatures et l'historique des visites.",
  },
  {
    title: 'Saisir un compte rendu de visite',
    body: "Depuis le dossier de l'étudiant, sur la candidature concernée, saisissez la date, le mode (présentiel, visio, téléphone) et vos observations. Décochez « Partager » pour une note interne, invisible pour l'étudiant.",
  },
];

const ADMIN_STEPS = [
  {
    title: 'Créer le référentiel',
    body: "« Établissements et formations » : créez d'abord l'établissement, puis les formations (tout niveau : CAP, bac pro, BTS, BUT, licence, master, titre pro…), puis les promotions.",
  },
  {
    title: 'Créer les comptes',
    body: "« Comptes » → « Nouveau compte » pour une création unitaire, ou l'import CSV pour une promotion entière. Le mot de passe provisoire est affiché une seule fois : transmettez-le à l'utilisateur.",
  },
  {
    title: 'Exporter les données',
    body: "Depuis « Comptes », exportez les utilisateurs, les CV ou les candidatures au format CSV, exploitables dans un tableur ou par le système d'information de l'établissement.",
  },
  {
    title: 'Suivre l’usage',
    body: "« Statistiques » agrège les comptes, les CV, les exports PDF, les candidatures par statut et les compétences les plus déclarées.",
  },
];

function Steps({ title, steps }) {
  return (
    <section className="sheet sheet--ruled" style={{ marginBottom: '1.25rem' }}>
      <h2 style={{ marginBottom: '0.75rem' }}>{title}</h2>
      <ol className="list-reset">
        {steps.map((step, i) => (
          <li key={step.title} style={{ display: 'grid', gridTemplateColumns: '2.4rem 1fr', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--rule)' }}>
            <span className="mono small" style={{ color: 'var(--ink-faint)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Help() {
  const { user } = useAuth();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Aide</h1>
          <p>Le mode d’emploi de la plateforme, dans l’ordre où vous en aurez besoin.</p>
        </div>
      </div>

      {(user.role === 'student' || user.role === 'admin') && <Steps title="Créer et diffuser son CV" steps={STUDENT_STEPS} />}
      {(user.role === 'tutor' || user.role === 'admin') && <Steps title="Suivi pédagogique" steps={TUTOR_STEPS} />}
      {user.role === 'admin' && <Steps title="Administration" steps={ADMIN_STEPS} />}

      <section className="sheet">
        <h2>Questions fréquentes</h2>
        <div className="divider" />
        <h3>Mon PDF déborde sur deux pages</h3>
        <p className="small muted">
          Passez au modèle Compact, raccourcissez le profil et gardez trois à quatre missions par
          expérience. Un CV de première expérience tient sur une page.
        </p>
        <h3>Je ne trouve pas ma formation</h3>
        <p className="small muted">
          Le référentiel est géré par l’administrateur de votre établissement. Laissez le champ vide et
          demandez-lui d’ajouter la formation : tous les niveaux sont pris en charge.
        </p>
        <h3>Qui voit mes candidatures ?</h3>
        <p className="small muted">
          Vous, votre référent et les administrateurs. Les autres étudiants n’y ont jamais accès.
        </p>
        <h3>J’ai oublié mon mot de passe</h3>
        <p className="small muted">
          L’administrateur de votre établissement le réinitialise et vous transmet un mot de passe
          provisoire, à changer à la première connexion.
        </p>
      </section>
    </>
  );
}
