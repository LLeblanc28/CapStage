# CapStage

Plateforme web de création de CV et de suivi de recherche de stage, d'alternance ou d'emploi,
destinée aux établissements de formation.

La plateforme est **générique** : elle ne dépend d'aucun établissement ni d'aucun diplôme en
particulier. Un lycée, un CFA, une université, une école ou un organisme de formation peut y déclarer
ses formations à n'importe quel niveau (collège, CAP, bac pro, bac techno, bac général, BTS, BUT,
licence, licence pro, master, ingénieur, doctorat, titre professionnel) et ses promotions.

## Ce que fait la plateforme

**Pour l'apprenant**
- Inscription et compte personnel.
- Création de plusieurs CV via des formulaires (profil, expériences, formation, compétences,
  langues, certifications, centres d'intérêt, liens), sans mise en page à gérer.
- Trois modèles de CV (Classique, Moderne, Compact), couleur d'accent, photo facultative.
- Export PDF généré côté serveur, à volonté.
- Suivi de ses candidatures : organisation, canal, date, statut, relances, contacts, notes.

**Pour le référent (enseignant, tuteur pédagogique)**
- Vue de tous les étudiants de son périmètre (ses promotions, sinon son établissement) avec
  l'avancement de leur recherche.
- Consultation des CV et des candidatures.
- Saisie des comptes rendus de visite de stage, partagés ou internes.

**Pour l'administrateur**
- Tableau de bord d'usage (comptes, CV, exports PDF, candidatures par statut, compétences
  déclarées, activité).
- Gestion des comptes : création unitaire, import CSV d'une promotion, réinitialisation de mot de
  passe, activation/désactivation, suppression.
- Gestion du référentiel : établissements, formations, promotions.
- Exports CSV (utilisateurs, CV, candidatures) pour l'interopérabilité avec le système
  d'information existant.

**Pour tous** : un annuaire des CV filtrable (établissement, formation, niveau, compétence, ville,
type de recherche), dans le respect de la visibilité choisie par chaque auteur.

## Pile technique

100 % logiciels libres, sans dépendance à un service tiers payant.

| Couche | Choix | Licence |
| --- | --- | --- |
| Serveur | Node.js 22 + Express 4 | MIT |
| Base de données | SQLite (module natif `node:sqlite`), base centralisée | domaine public |
| PDF | PDFKit (génération côté serveur) | MIT |
| Interface | React 18 + Vite, client léger (navigateur) | MIT |
| Sécurité | bcrypt, JWT en cookie httpOnly, CSRF double-submit, Helmet, limitation de débit | MIT |

## Démarrage rapide

```bash
npm run install:all
```

```bash
npm run db:init
```

```bash
npm run db:seed
```

```bash
npm run dev
```

L'interface de développement est servie par Vite sur <http://localhost:5173>, l'API sur
<http://localhost:3001>.

Comptes de démonstration (mot de passe commun `CapStage2026!`) :

| Rôle | Adresse |
| --- | --- |
| Administrateur | `admin@capstage.fr` |
| Référent | `referent.fulbert@capstage.fr` |
| Étudiante | `lea.morel@capstage.fr` |

Mise en production : voir [docs/installation.md](docs/installation.md).

## Mise en ligne

CapStage est une application Node.js : elle a besoin d'un serveur qui exécute du code. **GitHub
Pages ne peut pas l'héberger** — Pages ne sert que des fichiers statiques, sans API, sans base de
données ni génération de PDF. Trois voies possibles :

| Objectif | Solution | Mise en œuvre |
| --- | --- | --- |
| Site public utilisable | Hébergeur Node (Render, Fly.io, Koyeb, VPS) | `render.yaml` fourni : connecter le dépôt, Render lit le blueprint et déploie à chaque push |
| Conteneur | Docker | `Dockerfile` fourni : `docker build -t capstage . && docker run -p 3001:3001 -v capstage-data:/data -e JWT_SECRET=… capstage` |
| Démonstration ponctuelle | GitHub Codespaces | Ouvrir le dépôt dans un Codespace, `npm run install:all && npm run db:seed && npm run dev`, puis rendre le port 3001 public |

Le dossier `docs/` peut, lui, être publié sur GitHub Pages (Settings → Pages → source `main` /
`docs`) : cela met la documentation en ligne, pas l'application.

Variables d'environnement indispensables en production : `NODE_ENV=production`, `JWT_SECRET`
(chaîne aléatoire d'au moins 32 caractères) et `DATA_DIR` pointant vers un stockage persistant.
Sans disque persistant, la base SQLite est recréée à chaque redémarrage : mettre alors
`SEED_ON_START=true` pour disposer du jeu de démonstration.

## Tests

```bash
npm test
```

26 tests d'intégration couvrent l'authentification, les droits d'accès, l'édition des CV, la
génération des trois PDF, le suivi des candidatures et des visites, l'annuaire et l'administration.

## Documentation

- [Installation et exploitation](docs/installation.md)
- [Documentation technique](docs/documentation-technique.md)
- [Guide utilisateur](docs/guide-utilisateur.md)
- Plan de formation des utilisateurs finaux — à rédiger

## Licence

MIT.
