#!/usr/bin/env bash
set -e

REPO="https://github.com/albavxs/AlgoriUI.git"
DIR="AlgoriUI"

if [ -d "$DIR" ]; then
  echo "Pasta $DIR já existe. Entrando..."
else
  echo "Clonando $REPO..."
  git clone "$REPO"
fi

cd "$DIR"
echo "Instalando dependências..."
npm install
echo ""
echo "Pronto! Rode: cd $DIR && npm run dev"
echo "Abra http://localhost:3000"
