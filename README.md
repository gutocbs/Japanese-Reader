# Japanese Reader

Aplicação local para leitura e estudo de japonês. A aplicação usa React,
TypeScript e Vite no frontend, FastAPI no backend e SQLite para manter a
biblioteca e o cache de análises. O desenvolvimento é executado diretamente na
máquina, sem Docker.

## Requisitos

- Python 3.12 (`>=3.12,<3.13`) e [uv](https://docs.astral.sh/uv/getting-started/installation/).
- Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` e npm (22.x a partir de 22.22.2,
  24.x a partir de 24.15.0, ou 26.0.0 em diante).
- PowerShell no Windows para o comando conjunto `npm run dev`.

## Instalação

Na raiz do repositório:

```powershell
uv sync --locked
npm --prefix frontend ci
```

O `uv` seleciona Python 3.12 e cria `.venv`. SudachiPy e SudachiDict Core têm
versões fixas; `uv.lock` e `frontend/package-lock.json` registram as dependências
resolvidas. A instalação inicial requer internet para baixar os pacotes e o
dicionário; a execução local não depende de serviços externos.

## Executar localmente

```powershell
npm run dev
```

Abra <http://127.0.0.1:5173>. O runner inicia Uvicorn com reload na porta 8000 e
Vite na porta 5173, grava logs em `.dev/` e encerra os processos iniciados ao
pressionar Ctrl+C. Se um processo terminar, o outro também será encerrado.
Use portas livres antes de iniciar.

Cada processo também pode ser iniciado separadamente, em terminais distintos:

```powershell
npm run dev:backend
npm run dev:frontend
```

O Vite encaminha `/api` para `http://localhost:8000`. O endpoint
`GET /api/health` retorna exatamente `{"status":"ok"}`. A documentação da API
fica em <http://127.0.0.1:8000/docs>.

Por padrão, o backend grava em `./data/japanese-reader.db`, relativo ao diretório
em que ele é iniciado. Defina `DATABASE_PATH` com um caminho de arquivo diferente
quando necessário, por exemplo:

```powershell
$env:DATABASE_PATH = 'D:\JapaneseReader\japanese-reader.db'
npm run dev:backend
```

O diretório pai é criado automaticamente. `DATABASE_PATH=:memory:` é destinado
somente a execuções explícitas e testes. O caminho configurável poderá apontar
para um volume persistente quando o empacotamento Docker for implementado; esta
etapa ainda não adiciona arquivos Docker.

## Verificação

```powershell
uv run pytest
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

Na raiz, `npm test` executa os testes do backend e frontend e `npm run build`
verifica TypeScript e gera o frontend em `frontend/dist/`. `npm --prefix frontend
test` mantém o Vitest em modo watch durante o desenvolvimento.

## Arquitetura e plano

Consulte [a especificação aprovada](docs/superpowers/specs/2026-09-26-japanese-reader-design.md)
e [o plano de implementação](docs/superpowers/plans/2026-09-26-japanese-reader-mvp.md).
Documentos, seleções, preferências de furigana, overrides de leitura e análises
compatíveis são persistidos em SQLite. O conteúdo de `Document.content` continua
sendo a fonte canônica; análises são cache derivado e podem ser recriadas.

## API contracts

Document CRUD uses `GET/POST /api/documents` and `GET/PUT/DELETE /api/documents/{id}`.
`PUT` accepts title, content, or both; omitted fields stay unchanged, null fields
and empty updates return 422. Documents use camelCase JSON keys. Errors expose
`type`, `title`, `status`, and `detail` as `application/problem+json`.

OpenAPI is the source for frontend DTOs. After changing HTTP schemas or routes:

```powershell
npm --prefix scripts/openapi ci
npm run api:generate
```

Commit both `frontend/openapi.json` and `frontend/src/shared/api/generated.ts`.
Do not edit generated types manually. The isolated generator package uses
TypeScript 5 to satisfy `openapi-typescript`'s peer requirement; the application
continues using its locked TypeScript 7 compiler. The typed transport lives in
`frontend/src/shared/api/client.ts` and preserves HTTP error bodies and status.
