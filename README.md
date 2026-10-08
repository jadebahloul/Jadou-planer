# Jadou Planner ♡

**My personal life operating system** — une application web locale, privée et esthétique pour organiser toute ma vie : études, TOEIC, alternance, activité de cils, Instagram, argent, investissements, immobilier, Airbnb, sport, nutrition, beauté, voyages, habitudes et objectifs. Avec **Jadou AI**, une assistante qui comprend le français et agit dans l'application **après confirmation**.

> Your life, beautifully organized.

---

## 1. Démarrage rapide

**Le plus simple :** télécharge le projet (bouton vert « Code » › « Download ZIP » sur GitHub, puis dézippe), installe [Node.js LTS](https://nodejs.org), et double-clique sur :
- **Mac** : `Lancer Jadou Planner (Mac).command` (au premier lancement : clic droit › Ouvrir si macOS bloque le fichier)
- **Windows** : `Lancer Jadou Planner (Windows).bat`

La première fois, l'installation prend quelques minutes, puis le navigateur s'ouvre sur **http://localhost:4317**. Laisse la fenêtre du terminal ouverte tant que tu utilises l'application.

**En ligne de commande :**

Prérequis : **Node.js 20+** (testé avec Node 22).

```bash
git clone <ce dépôt> jadou-planner
cd jadou-planner
npm run setup      # installe les dépendances, crée la base SQLite, compile l'interface
npm start          # lance Jadou Planner
```

Ouvre ensuite **http://localhost:4317** : au premier lancement, tu choisis ton mot de passe local. Le programme sportif (Lower Body A / B, Home Workout), la liste de prestations cils, des habitudes, des routines skincare, des modèles de messages et un premier lot de vocabulaire TOEIC sont préparés automatiquement — **aucune fausse donnée** (pas de transactions, statistiques ou historiques inventés).

Mode développement (rechargement à chaud) :

```bash
npm run dev        # API sur :4317 + interface Vite sur http://localhost:5173
```

Autres commandes : `npm test` (tests unitaires + test d'intégration API), `npm run typecheck`, `npm run build`, `npm run migrate`.

### Sur téléphone / tablette
L'interface est responsive (navigation mobile dédiée, barre d'onglets + bouton Quick Add). Par sécurité le serveur n'écoute que sur `127.0.0.1`. Pour l'ouvrir depuis ton téléphone sur ton Wi-Fi personnel, lance `JADOU_ALLOW_LAN=1 npm start` puis ouvre `http://<ip-de-ton-ordinateur>:4317` (à n'utiliser que sur un réseau de confiance).

---

## 2. Ce que fait l'application

| Espace | Modules |
|---|---|
| **Home** | Dashboard personnalisable (widgets réorganisables / masquables, photo d'en-tête), My Calendar (jour / semaine / mois / agenda, glisser-déposer, récurrence, rappels, filtres, recherche, détection de conflits), My Tasks (aujourd'hui, semaine, en retard, toutes, kanban, sous-tâches, récurrence, mode focus Pomodoro), Command Center |
| **Wellness** | Fitness (programme modifiable, **Workout Mode** avec chrono / repos / « Série terminée », progression charges-répétitions-volume-records-régularité, Exercise Library, objectifs), Nutrition (journal + macros, favoris, recettes, planning, liste de courses), Water Tracker, Body Progress (privé), Wellness (sommeil, humeur, énergie, digestion, cycle facultatif), Beauty & Self-Care (routines à cocher, produits, Haircare Tracker, RDV, dépenses) |
| **Studies & Career** | My Master (EDT, devoirs avec compte à rebours, examens, projets de groupe en kanban, notes et moyennes pondérées), TOEIC Academy (objectif 600+, exercices originaux des 7 parties avec audio, chrono, corrections, historique, révision ciblée, Vocabulary Book à répétition espacée, Mistake Tracker, planning → tâches), Master Thesis, Pharmacy Work (dashboard, planner Instagram/TikTok, campagnes, bibliothèque, performance) |
| **Business** | Lash Studio (agenda, rendez-vous, clientes avec historique et dépenses cumulées, prestations et marges, CA jour / semaine / mois, panier moyen, résultat estimé, stock avec alertes, objectifs, messages), Instagram Manager (connexion API Meta officielle, planner, bibliothèque, analytics croisées avec les RDV et le CA, demandes clientes), Entrepreneurship (side hustles, rentabilité horaire), Business Ideas (fiches + roadmap en 8 étapes) |
| **Money** | My Banks (comptes, transactions, virements internes, **import CSV avec détection des doublons**, analytics), Budget mensuel, Savings Goals (versement mensuel nécessaire calculé), Investments (portefeuille, performance, simulateur avec avertissement), Real Estate (biens, rentabilité, cash-flow, comparateur, simulateur), Airbnb (réservations, taux d'occupation, ménage auto, modèles de messages, documents) |
| **Lifestyle** | Wishlist façon Pinterest (purchase planner, lien objectif d'épargne, budget), Travel Planner (checklist, dépenses, galerie), Habit Tracker (calendrier mensuel, séries, validation automatique), Vision Board, Personal Journal |
| **Organization** | Resource Hub (dossiers, tags, favoris, aperçu, téléchargement, plans de ressources), Goals (hebdo → long terme, étapes), Weekly Review / Monthly Reset (bilans auto + 3 priorités, export PDF par impression), Life Analytics (comparaison semaine / mois / trimestre / année) |
| **Assistant** | Jadou AI (bouton flottant « Ask Jadou AI ♡ » partout, page dédiée, mémoire locale modifiable) |
| **Settings** | Profil & mot de passe, thèmes (Rose poudré, Champagne, Nuit bordeaux), modules affichés, notifications, intégrations (Ollama, Instagram, météo), Data & Privacy (sauvegardes / restauration, exports JSON & CSV, mémoire IA, **Document Vault chiffré**) |

Partout : **Quick Add / Quick Capture** (`⌘/Ctrl + J`) — écris une phrase libre (« Resto avec Inès 24 € hier », « RDV cils vendredi 14h avec Sarah, remplissage ») : la catégorie et les champs sont proposés, tu valides. **Recherche globale** (`⌘/Ctrl + K`) dans toutes les données. **Rappels** dans la cloche (et notifications du navigateur si tu les autorises).

### Une seule saisie suffit (interconnexions)
- **RDV cils** → calendrier global, fiche cliente, statistiques ; « Réalisé » = chiffre d'affaires ; « Encaissé » + compte = revenu dans My Banks (acompte géré, annulation = retrait du revenu).
- **Devoir** → Studies + My Tasks + My Calendar (statut synchronisé dans les deux sens).
- **Dépense** → solde du compte, budget, analyses. Les **virements internes ne sont jamais comptés comme revenus**.
- **Séance** → calendrier, statistiques, objectifs, habitude « Sport » validée automatiquement.
- **Réservation Airbnb** → calendrier, tâche ménage au départ, revenu net une fois payée.
- **Produit wishlist** → galerie, catégorie, objectif d'épargne ; acheté + compte = dépense.
- **Révisions TOEIC planifiées**, priorités de bilan, actions de Jadou AI → My Tasks & My Calendar.

---

## 3. Jadou AI

Deux moteurs, **100 % locaux** :

1. **Mode local (toujours disponible, sans IA)** — un moteur déterministe qui comprend les demandes courantes et calcule à partir de tes vraies données : priorités, « organise ma journée / ma semaine » (placement dans tes créneaux libres), devoirs, « programme mes révisions TOEIC », « trouve-moi deux créneaux pour le sport », soldes, épargne, bilan financier, activité la plus rentable, CA cils, bilan Airbnb, wishlist & budget, checklist de voyage, « souviens-toi que… », création de tâches / RDV / dépenses / produits…
2. **Ollama (optionnel)** pour les conversations libres et la rédaction (idées de contenus, légendes, conseils). Installation :
   ```bash
   # 1. installer Ollama : https://ollama.com
   ollama pull llama3.1:8b     # ou un autre modèle, à choisir dans Settings › Integrations
   ```
   Jadou Planner le détecte automatiquement (`http://127.0.0.1:11434`, seules les adresses locales sont acceptées). Le modèle reçoit un résumé de tes données (sans données de santé, sauf autorisation) et doit répondre en JSON : chaque action proposée est **validée par le serveur puis confirmée par toi** avant tout enregistrement. Aucune publication automatique.

La **mémoire** (objectifs, préférences, projets, décisions) est stockée localement et modifiable dans la page Jadou AI ou Settings › Data & Privacy.

---

## 4. Intégrations externes — conditions

| Intégration | État | Conditions |
|---|---|---|
| **Instagram** | Implémentée (OAuth officiel « Instagram API with Instagram Login », lecture profil / statistiques / publications), **non testée avec un vrai compte** dans cet environnement | Compte Instagram **professionnel**, app sur developers.facebook.com, **URL de redirection HTTPS** se terminant par `/api/instagram/callback` (ex. tunnel HTTPS vers ton ordinateur), App ID + App Secret dans Settings › Integrations. Le jeton est chiffré localement. Messages privés : non consultés (permission `instagram_business_manage_messages` + validation Meta nécessaires) → saisie manuelle dans « Demandes ». Sans connexion, tout fonctionne en saisie manuelle des statistiques. |
| **Banques** | Saisie manuelle + import CSV | Aucun identifiant bancaire n'est jamais demandé. Une synchronisation automatique nécessiterait un prestataire agréé DSP2 (non incluse). |
| **Météo** | Optionnelle, désactivée par défaut | Open-Meteo (sans compte), seule la ville est transmise. |
| **Cours de bourse** | Non inclus | Les prix actuels des investissements se mettent à jour manuellement (aucune donnée de marché inventée). |

---

## 5. Architecture technique

```
shared/        Registre des 64 entités (champs, types, options) + dates, finance, parser NL français
server/        Node.js · Express · Prisma · SQLite
  scripts/     gen-prisma.ts (schéma généré depuis le registre), migrate.ts (sauvegarde + db push sûr)
  src/         auth, crud générique validé, records.ts (règles d'interconnexion), calendar (flux unifié),
               stats, notifications, search, files, vault, backup/export, import CSV, instagram, weather, ai/
web/           React 18 · TypeScript · Vite · Tailwind CSS · composants style shadcn/ui (Radix) · Lucide
               Recharts (palette validée daltonisme, clair/sombre) · FullCalendar · Motion · TanStack Query · dnd-kit
tests/         Vitest : logique partagée + test d'intégration de l'API sur base temporaire
data/          (créé au lancement, ignoré par git) jadou.db, uploads/, vault/, backups/, secret.key
```

- **Registre unique** (`shared/registry.ts`) : chaque entité est décrite une fois ; il génère le schéma Prisma, la validation serveur et les formulaires / tableaux. Ajouter un champ = une ligne.
- **Toutes les écritures** (interface, Quick Capture, Jadou AI) passent par `server/src/records.ts`, qui applique les règles d'interconnexion.
- **Évolutivité** : à chaque `npm start`, une copie de la base est faite puis le schéma est synchronisé (`prisma db push` refuse toute modification destructive).

### Sécurité & confidentialité
- Serveur lié à `127.0.0.1` uniquement (pas d'exposition Internet par défaut).
- Authentification locale (bcrypt), session en cookie `HttpOnly` `SameSite=Strict`, en-tête anti-CSRF obligatoire, limitation des tentatives.
- Validation de chaque formulaire côté serveur ; filtres de requête restreints aux champs connus.
- Fichiers : types autorisés, 50 Mo max, noms aléatoires, `nosniff`, téléchargement forcé pour les types non affichables.
- **Document Vault** : AES-256-GCM, clé dérivée (scrypt) d'une phrase secrète jamais stockée, reverrouillage après 10 min.
- Secrets d'intégration chiffrés (`data/secret.key`). Aucune donnée envoyée à l'extérieur sans action explicite.

### Sauvegardes
Sauvegarde automatique quotidienne (base + fichiers) dans `data/backups/`, rotation configurable, sauvegarde manuelle, téléchargement et **restauration** depuis Settings › Data & Privacy (une sauvegarde de sécurité est créée avant chaque restauration). Exports JSON complet et CSV par module ; PDF des bilans via l'impression.

---

## 6. Visuels
L'application n'embarque **aucune image de stock ni illustration générée** : les couvertures par défaut sont des compositions graphiques (dégradés, arcs fins, grain papier) dans la palette. Tu peux **ajouter tes propres photos** : en-tête du dashboard, couverture de chaque module (icône en haut à droite), wishlist, vision board, voyages, exercices, progression…

Palette : blanc cassé `#FAF8F6`, blanc `#FFFFFF`, rose poudré `#EBCBD0`, rose très clair `#F7E9EC`, bordeaux `#713F4B`, beige `#EDE5DD`, texte `#292527`, gris `#8B8185`. Typographies : Plus Jakarta Sans (interface) et Cormorant Garamond (titres), embarquées localement.

---

## 7. Limites connues (en toute transparence)
- Instagram : code conforme à l'API officielle mais non testé de bout en bout sans app Meta ni compte réel ; les métriques d'insights disponibles dépendent de Meta.
- TOEIC : banque de 63 questions originales (pas de sujets officiels). Les parties d'écoute utilisent la synthèse vocale du navigateur ; la Part 1 utilise des scènes illustrées au lieu de photographies. Tu peux ajouter tes propres ressources autorisées.
- Les rappels sont calculés tant que l'application est ouverte (pas de service en arrière-plan ni de notifications push mobiles).
- Les calories / macros sont des estimations saisies par toi (pas de base nutritionnelle).
- Les simulations (investissement, immobilier) sont hypothétiques et ne garantissent aucun rendement.
