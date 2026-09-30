# Empacotamento Docker do Japanese Reader

## Objetivo

Adicionar uma forma reproduzível de executar o Japanese Reader em Docker sem
alterar o fluxo de desenvolvimento local. A aplicação continuará sendo um
monólito React + FastAPI, com o FastAPI como processo da imagem final e SQLite
persistido em um volume local.

## Decisões

- O frontend será compilado em um estágio Node multi-stage.
- A imagem final será baseada em Python 3.12 e conterá apenas o backend, seus
  artefatos Python e o `frontend/dist` compilado.
- O FastAPI servirá os arquivos estáticos do frontend e fará fallback para
  `index.html` nas rotas do SPA que não forem `/api`.
- A porta publicada será `8000`; a mesma origem atenderá a interface e a API.
- O banco será configurado por `DATABASE_PATH=/app/data/japanese-reader.db`.
- O Compose montará `./data:/app/data`, preservando o banco entre recriações do
  container.
- O endpoint `GET /api/health` será usado pelo healthcheck do Compose.
- O desenvolvimento local continuará usando Vite e Uvicorn separadamente; os
  artefatos Docker não serão necessários para `npm run dev`.

## Artefatos

- `Dockerfile`: build multi-stage e comando de execução do Uvicorn.
- `docker-compose.yml`: serviço único, porta, volume, ambiente e healthcheck.
- `.dockerignore`: exclui dependências, builds locais, banco e arquivos de
  desenvolvimento do contexto de build.
- Documentação no `README.md` com build, execução, atualização e localização
  dos dados persistidos.

## Validação

- `docker compose config` deve aceitar o Compose sem erros.
- A imagem deve compilar quando o daemon Docker estiver disponível.
- O container deve responder `200` com `{"status":"ok"}` em `/api/health`.
- O frontend deve abrir pela porta publicada e continuar acessando `/api` na
  mesma origem.
- O banco deve permanecer no diretório `data` após recriar o container.

## Fora de escopo

- Orquestração de produção, TLS, proxy reverso externo e publicação em registry.
- Migração do fluxo local para Docker.
- Alterações funcionais na API ou na interface.
