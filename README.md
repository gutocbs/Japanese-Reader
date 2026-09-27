# Japanese Reader

Aplicação local para leitura e estudo de japonês. A fundação atual contém React,
TypeScript e Vite no frontend, FastAPI no backend e testes dos dois projetos.
O desenvolvimento é executado diretamente na máquina, sem Docker.

## Requisitos

- Python 3.12 (`>=3.12,<3.13`) e [uv](https://docs.astral.sh/uv/getting-started/installation/).
- Node.js 22.12 ou mais recente e npm.
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
As funcionalidades de documentos, análise linguística e persistência serão
implementadas nas próximas tarefas.
