#!/bin/bash
# Double-clique sur ce fichier pour lancer Jadou Planner ♡
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Télécharge-le sur https://nodejs.org (version LTS), puis relance ce fichier."
  open "https://nodejs.org"
  read -n 1 -s -r -p "Appuie sur une touche pour fermer…"
  exit 1
fi
if [ ! -d node_modules ] || [ ! -d web/dist ]; then
  echo "Première installation (quelques minutes)…"
  npm run setup || { read -n 1 -s -r -p "Erreur d'installation. Appuie sur une touche…"; exit 1; }
fi
( sleep 6; open "http://localhost:4317" ) &
npm start
