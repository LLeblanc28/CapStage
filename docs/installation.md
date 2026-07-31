# Installation et exploitation

Ce document s'adresse à la personne qui installe et maintient CapStage (service informatique de
l'établissement ou prestataire).

## 1. Prérequis

| Élément | Version | Remarque |
| --- | --- | --- |
| Node.js | 22.5 ou supérieur | le module `node:sqlite` est requis ; vérifier avec `node -v` |
| npm | 10 ou supérieur | livré avec Node.js |
| Système | Linux, Windows Server ou macOS | testé sous Windows 11 et Debian 12 |
| Espace disque | 500 Mo | dont environ 300 Mo de dépendances |
| Navigateur client | Chrome, Firefox, Edge ou Safari à jour | client léger, aucune installation poste |

Aucun serveur de base de données n'est à installer : la base est un fichier SQLite unique, centralisé
sur le serveur applicatif.

## 2. Récupération et installation

```bash
git clone <depot> capstage && cd CapStage
```

```bash
npm run install:all
```

## 3. Configuration

Copier `.env.example` en `.env` et adapter les valeurs.

```bash
cp .env.example .env
```

| Variable | Rôle | Valeur conseillée en production |
| --- | --- | --- |
| `NODE_ENV` | mode d'exécution | `production` |
| `PORT` | port d'écoute | `3001` (derrière un reverse proxy) |
| `DATA_DIR` | dossier des données (base + photos) | chemin sauvegardé, hors du dépôt |
| `DB_FILE` | nom du fichier de base | `capstage.sqlite` |
| `JWT_SECRET` | secret de signature des sessions | **obligatoire**, 48 octets aléatoires |
| `SESSION_HOURS` | durée d'une session | `12` |
| `MAX_PHOTO_BYTES` | taille maximale d'une photo | `1500000` |
| `PLATFORM_NAME` | nom affiché dans l'interface | nom de l'établissement ou du groupement |

Génération du secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Le serveur refuse de démarrer en production si `JWT_SECRET` est resté à la valeur d'exemple.

## 4. Initialisation de la base

```bash
npm run db:init
```

La commande crée les 18 tables et est **idempotente** : elle peut être relancée après une mise à
jour sans perte de données.

Pour disposer d'un jeu de démonstration (5 établissements, 10 formations de niveaux variés,
11 promotions, 8 comptes) :

```bash
npm run db:seed
```

En développement uniquement, `npm run db:reset` supprime la base et la recrée vide.

## 5. Compilation de l'interface

```bash
npm run build
```

Le serveur Express détecte `client/dist` et sert l'interface : un seul processus, un seul port.

## 6. Démarrage

```bash
npm start
```

Vérification :

```bash
curl http://localhost:3001/api/health
```

La réponse attendue est `{"status":"ok", ...}`.

### Service systemd (Linux)

```ini
[Unit]
Description=CapStage
After=network.target

[Service]
Type=simple
User=capstage
WorkingDirectory=/opt/capstage
EnvironmentFile=/opt/capstage/.env
ExecStart=/usr/bin/node server/src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Service Windows

Utiliser un gestionnaire de service (NSSM, `sc.exe`) pointant sur
`node.exe C:\capstage\server\src\index.js`, avec le répertoire de travail `C:\capstage`.

## 7. Reverse proxy et HTTPS

L'application doit être publiée derrière un reverse proxy assurant TLS. Les cookies de session
passent en `Secure` dès que `NODE_ENV=production`.

Exemple Nginx :

```nginx
server {
    listen 443 ssl;
    server_name cv.mon-etablissement.fr;

    ssl_certificate     /etc/letsencrypt/live/cv.mon-etablissement.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cv.mon-etablissement.fr/privkey.pem;

    client_max_body_size 4m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proto;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 8. Premier administrateur

Après `npm run db:init` sur une base vierge, créer le compte d'administration :

```bash
node -e "import('./server/src/lib/security.js').then(async ({hashPassword})=>{const {run}=await import('./server/src/db/index.js');run('INSERT INTO user (email, password_hash, first_name, last_name, role) VALUES (?,?,?,?,\"admin\")',['admin@etablissement.fr', await hashPassword('MotDePasseProvisoire1'),'Prénom','Nom']);console.log('compte admin créé');})"
```

Se connecter avec ce compte, changer immédiatement le mot de passe depuis « Profil », puis créer le
référentiel et les comptes depuis l'interface d'administration.

## 9. Sauvegarde et restauration

Tout l'état applicatif tient dans `DATA_DIR` : le fichier SQLite et le dossier `uploads/`.

Sauvegarde à chaud, sans arrêter le service :

```bash
sqlite3 data/capstage.sqlite ".backup '/sauvegardes/capstage-$(date +%F).sqlite'"
```

Sans l'outil `sqlite3`, arrêter le service puis copier `data/` entièrement (y compris les fichiers
`-wal` et `-shm`).

Restauration : arrêter le service, remplacer le contenu de `DATA_DIR`, redémarrer.

Fréquence conseillée : quotidienne pendant la période de recherche de stage, hebdomadaire le reste
de l'année, avec conservation de 30 jours.

## 10. Mise à jour

```bash
git pull
npm run install:all
npm run db:init
npm run build
```

puis redémarrer le service. Sauvegarder la base avant toute mise à jour.

## 11. Supervision

- `GET /api/health` : état du service et nombre de comptes, à interroger par la supervision.
- Journaux applicatifs : sortie standard du processus (`journalctl -u capstage` sous systemd).
- Journal fonctionnel : table `event_log`, exposée dans « Statistiques » (connexions, exports,
  créations de CV, imports).

## 12. Incidents courants

| Symptôme | Cause probable | Correction |
| --- | --- | --- |
| `JWT_SECRET doit etre defini en production` | secret d'exemple conservé | générer un secret et redémarrer |
| `SQLITE_BUSY` dans les journaux | sauvegarde par copie pendant une écriture | utiliser `.backup` ou arrêter le service |
| Interface blanche, API accessible | `client/dist` absent | lancer `npm run build` |
| Déconnexions fréquentes | `SESSION_HOURS` trop faible ou secret régénéré à chaque déploiement | fixer le secret dans `.env` |
| PDF vide ou tronqué | CV sans contenu | vérifier que le CV contient au moins une section |
| `413 Fichier trop volumineux` | photo au-delà de la limite | augmenter `MAX_PHOTO_BYTES` et `client_max_body_size` |

## 13. Données personnelles

La plateforme traite des données d'identité, de scolarité et de recherche de stage. Points de
conformité à tenir côté établissement :

- inscrire le traitement au registre RGPD de l'établissement ;
- informer les apprenants à l'inscription (finalité, durée de conservation, droits) ;
- purger les comptes des promotions sorties (suppression depuis « Comptes », qui supprime en cascade
  CV, candidatures et visites) ;
- limiter le nombre de comptes administrateurs ;
- restreindre l'accès au dossier `DATA_DIR` au seul compte système du service.
