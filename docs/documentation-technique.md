# Documentation technique

## 1. Architecture

```
Navigateur (client léger)
        │  HTTPS
        ▼
Reverse proxy (Nginx / IIS)
        │  HTTP local
        ▼
┌─────────────────────────────────────────────┐
│ Node.js 22 — Express                        │
│  ├── /api/*        API REST JSON            │
│  ├── /uploads/*    photos (authentifié)     │
│  └── /*            interface React compilée │
│                                             │
│  services/pdf  → PDFKit (génération PDF)    │
│  db            → node:sqlite (WAL)          │
└─────────────────────────────────────────────┘
        │
        ▼
   data/capstage.sqlite  +  data/uploads/
```

Un seul processus sert l'API, les fichiers et l'interface. La base est centralisée : tous les postes
clients travaillent sur la même donnée, aucun stockage local.

## 2. Arborescence

```
CapStage/
├── server/
│   ├── src/
│   │   ├── index.js              démarrage
│   │   ├── app.js                assemblage Express (testable)
│   │   ├── config.js             configuration et variables d'environnement
│   │   ├── db/                   schéma SQL, accès, migration, seed, reset
│   │   ├── lib/                  sécurité, validation Zod, CSV, erreurs
│   │   ├── middleware/           authentification, CSRF, gestion d'erreurs
│   │   ├── routes/               auth, cvs, directory, applications, tutor, admin
│   │   └── services/             logique métier CV, périmètres, génération PDF
│   └── tests/api.test.js         tests d'intégration (node --test)
├── client/
│   └── src/
│       ├── api.js, auth.jsx, labels.js, styles.css
│       ├── components/           Layout, aperçu CV, briques d'interface
│       └── pages/                une page par écran
├── docs/
└── data/                         base SQLite + photos (non versionné)
```

## 3. Modèle de données

18 tables. Le modèle est volontairement générique : `establishment` → `program` → `cohort` → `user`.

| Table | Rôle | Points notables |
| --- | --- | --- |
| `establishment` | structure de formation | `kind` : lycée, CFA, université, école, organisme… |
| `program` | formation | `level` parmi 14 niveaux ; `establishment_id` nul = formation générique |
| `cohort` | promotion | rattachée à une formation, `year_level` = année dans le cursus |
| `user` | compte | `role` : `student`, `tutor`, `admin` ; verrouillage après échecs |
| `tutor_cohort` | périmètre d'un référent | sans ligne, le référent voit tout son établissement |
| `cv` | en-tête d'un CV | modèle, couleur, visibilité, recherche en cours, compteurs |
| `cv_experience`, `cv_education`, `cv_skill`, `cv_language`, `cv_certification`, `cv_interest`, `cv_link` | sections | `sort_index` conserve l'ordre choisi |
| `application` | candidature | canal, statut, période, tuteur entreprise |
| `visit` | compte rendu de visite | auteur, mode, appréciation, `shared_with_student` |
| `event_log` | journal fonctionnel | alimente le tableau de bord |
| `setting` | paramètres | nom de plateforme, version de schéma |

Toutes les clés étrangères sont déclarées avec `ON DELETE CASCADE` ou `SET NULL` : supprimer un
compte supprime ses CV, ses candidatures et les visites associées.

Le schéma complet et commenté se trouve dans `server/src/db/schema.sql`.

### Règles de gestion

- Un utilisateur a **exactement un** CV principal (`is_default`), maintenu par `ensureOneDefault()`.
- Un CV est limité à 10 par compte.
- L'enregistrement d'un CV remplace ses sections dans une transaction : pas d'état intermédiaire.
- Les transactions imbriquées utilisent des `SAVEPOINT`.

## 4. API REST

Toutes les routes sont préfixées `/api`. Les réponses sont en JSON ; les erreurs suivent le format
`{ "error": "message", "details": [...] }`.

### Authentification

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | inscription (rôle `student` imposé), crée un CV vierge |
| POST | `/auth/login` | public | ouverture de session |
| POST | `/auth/logout` | connecté | fermeture de session |
| GET | `/auth/me` | public | session courante + jeton CSRF |
| PUT | `/auth/profile` | connecté | identité et rattachement |
| PUT | `/auth/password` | connecté | changement de mot de passe |

### Référentiel (lecture publique, nécessaire à l'inscription)

`GET /referentiel/establishments`, `/programs`, `/cohorts`, `/meta`.

### CV

| Méthode | Route | Accès |
| --- | --- | --- |
| GET / POST | `/cvs` | propriétaire |
| GET | `/cvs/:id` | selon visibilité, référent, admin |
| PUT / DELETE | `/cvs/:id` | propriétaire, admin |
| POST | `/cvs/:id/duplicate`, `/cvs/:id/default` | propriétaire |
| POST / DELETE | `/cvs/:id/photo` | propriétaire |
| GET | `/cvs/:id/pdf?template=&inline=1` | toute personne autorisée à lire le CV |

### Annuaire

`GET /directory?q&establishment_id&program_id&cohort_id&level&search_kind&city&skill&searching&sort&page&per_page`

### Candidatures et visites

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/applications`, `/applications/stats` | périmètre du demandeur |
| POST / PUT / DELETE | `/applications`, `/applications/:id` | propriétaire, admin |
| GET | `/applications/:id` | propriétaire, référent, admin |
| POST | `/applications/:id/visits` | référent, admin |
| DELETE | `/applications/:id/visits/:visitId` | auteur, admin |

### Suivi pédagogique

`GET /tutor/students`, `/tutor/students/:id`, `/tutor/overview` — réservé aux rôles `tutor` et
`admin`.

### Administration (rôle `admin`)

`GET /admin/stats` · `GET|POST /admin/users` · `PATCH|DELETE /admin/users/:id` ·
`POST /admin/users/:id/reset-password` · `POST /admin/users/import` ·
`GET /admin/export/{users,cvs,applications}.csv` · CRUD `/admin/establishments`, `/admin/programs`,
`/admin/cohorts`.

## 5. Sécurité

| Risque | Mesure |
| --- | --- |
| Vol de mot de passe | bcrypt, coût 12 ; jamais de mot de passe en clair ni en journal |
| Force brute | limitation de débit (30 tentatives / 10 min) et verrouillage du compte 15 min après 8 échecs |
| Vol de session | JWT signé, cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, durée limitée |
| CSRF | double-submit : jeton en cookie lisible + en-tête `X-CSRF-Token` obligatoire sur toute écriture |
| Injection SQL | requêtes préparées et paramétrées exclusivement |
| XSS | React échappe par défaut ; en-têtes CSP via Helmet ; aucun `dangerouslySetInnerHTML` |
| Données invalides | validation Zod de toutes les entrées, avec bornes de longueur |
| Élévation de privilège | contrôle de rôle et de propriété à chaque route ; l'inscription publique impose `student` |
| Fuite de données | l'annuaire applique la visibilité choisie ; les photos ne sont servies qu'aux comptes connectés |
| Fichiers malveillants | photo limitée à JPEG/PNG et à la taille configurée, stockée hors de l'arborescence web sous un nom généré |
| Auto-verrouillage admin | un administrateur ne peut ni se retirer son rôle, ni se désactiver, ni se supprimer |

### Matrice des droits

| Action | Étudiant | Référent | Admin |
| --- | :---: | :---: | :---: |
| Éditer son CV | ✔ | ✔ | ✔ |
| Voir un CV privé d'un autre | ✘ | ✔ (son périmètre) | ✔ |
| Voir un CV « établissement » | ✔ (même établissement) | ✔ | ✔ |
| Saisir une candidature | ✔ (la sienne) | ✘ | ✔ |
| Lire les candidatures d'un étudiant | ✘ | ✔ (son périmètre) | ✔ |
| Saisir un compte rendu de visite | ✘ | ✔ | ✔ |
| Lire un compte rendu non partagé | ✘ | ✔ | ✔ |
| Gérer comptes et référentiel | ✘ | ✘ | ✔ |

## 6. Génération des PDF

`server/src/services/pdf/` produit le document avec PDFKit, sans navigateur sans tête ni service
externe.

- Format A4, marges 46 pt, polices Helvetica intégrées (encodage WinAnsi : les accents, `œ` et les
  tirets typographiques sont rendus correctement).
- Trois rendus : `classique` (une colonne), `moderne` (bandeau latéral coloré redessiné à chaque
  page), `compact` (dense, compétences en étiquettes).
- Sauts de page gérés explicitement (`ensure()`), les lignes de description commençant par `-`
  deviennent des puces.
- Le compteur `cv.pdf_exports` et le journal `event_log` sont incrémentés à chaque export.

Ajouter un modèle : écrire une fonction de rendu, l'enregistrer dans `RENDERERS`, ajouter la valeur
dans `TEMPLATES` (`server/src/lib/schemas.js`) et dans `TEMPLATE_LABELS` côté client.

## 7. Interopérabilité

- **Import** : `POST /admin/users/import` accepte un CSV `email;prenom;nom;role;etablissement;promotion`
  (séparateur `;` ou `,`, BOM toléré). L'établissement est créé s'il manque ; chaque ligne en erreur
  est rapportée sans interrompre l'import. Les mots de passe provisoires sont renvoyés une seule fois.
- **Export** : trois exports CSV encodés UTF-8 avec BOM, séparateur `;`, directement exploitables
  dans un tableur ou par un ETL.
- **API** : toute intégration peut consommer l'API REST avec un compte dédié.

## 8. Tests

```bash
npm test
```

26 tests d'intégration (`node --test`) sur une base isolée dans `data/test` :

| Domaine | Ce qui est vérifié |
| --- | --- |
| Santé, référentiel | disponibilité, niveaux de formation multiples |
| Authentification | politique de mot de passe, session, rejet sans jeton CSRF, identifiants invalides |
| CV | enregistrement des sections, refus d'une URL non http(s), duplication, cloisonnement entre comptes |
| PDF | les trois modèles produisent un PDF valide et non vide |
| Candidatures | création, statistiques, interdiction faite à l'étudiant de saisir une visite |
| Visites | saisie par le référent, périmètre respecté, note interne invisible pour l'étudiant |
| Annuaire | visibilité privée respectée, recherche par compétence |
| Administration | refus pour un étudiant, statistiques, import CSV, export CSV, création d'une formation de niveau licence, protection du compte admin |
| Non-régression | répartition par niveau correcte lorsque deux promotions portent le même libellé |

## 9. Maintenance

- **Corrective** : les erreurs non gérées sont journalisées avec la trace ; en production, le détail
  n'est jamais renvoyé au client.
- **Évolutive** : le schéma est appliqué de façon idempotente au démarrage ; une évolution consiste à
  ajouter les instructions `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` dans `schema.sql` et à
  incrémenter `schema_version` dans `setting`.
- **Points d'extension prévus** : nouveau modèle de CV, nouveau niveau de formation (`LEVELS`),
  nouveau statut de candidature (`APPLICATION_STATUS`) — chaque énumération est déclarée une seule
  fois côté serveur et exposée par `/referentiel/meta`.

## 10. Performances

- Index sur toutes les clés étrangères et les colonnes filtrées.
- Mode WAL : lectures concurrentes pendant les écritures.
- Annuaire paginé (12 résultats par page par défaut, 48 maximum).
- Interface compilée : environ 264 Ko de JavaScript, 78 Ko compressés.
- Volumétrie cible : quelques milliers de comptes et de CV par instance, ce que SQLite absorbe
  sans difficulté pour cet usage. Au-delà, la couche d'accès (`server/src/db/index.js`) est
  suffisamment isolée pour migrer vers PostgreSQL.
