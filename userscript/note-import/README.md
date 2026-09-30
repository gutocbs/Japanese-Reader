# Importação de artigos do note.com

Este diretório registra o contrato para uma futura userscript do Tampermonkey. A userscript ainda não foi implementada nem validada em um navegador.

## Contrato da API local

- Método e endpoint: `POST /api/imports`.
- URL-base da API no desenvolvimento: `http://127.0.0.1:8000`.
- URL do endpoint no desenvolvimento: `http://127.0.0.1:8000/api/imports`.
- Corpo JSON estrito (propriedades adicionais não são aceitas):
  - `title`: string não em branco;
  - `text`: string;
  - `description`: string ou `null`;
  - `source`: string não em branco;
  - `tags`: array de `{ "name", "color" }`; `name` é string não em branco, `color` segue o formato `#RRGGBB`, e os nomes são únicos sem diferenciar maiúsculas de minúsculas.
- Sucesso: `201 Created`, com JSON de `DocumentResponse`.
- Falhas: `application/problem+json`, com `type`, `title`, `status` e `detail`. Os status relevantes no contrato atual incluem `422` e `503`.

## Mapeamento proposto

| Campo da importação | Origem na página note.com |
| --- | --- |
| `title` | título do artigo |
| `text` | corpo extraído do artigo |
| `description` | URL atual do artigo |
| `source` | `note.com` |
| `tags` | uma tag `{ "name": "note.com", "color": "#7C3AED" }` |

O valor de `text` deve ser enviado como extraído, sem normalização adicional definida por este contrato.

## Transporte e ambiente local

O frontend Vite usa a porta `5173` e encaminha `/api` ao backend na porta `8000`; isto é apenas contexto. A userscript chama a API local diretamente em `http://127.0.0.1:8000/api/imports`.

Não há middleware CORS configurado para essa integração. O transporte planejado é `GM_xmlhttpRequest` do Tampermonkey. A URL-base configurada para a requisição é `http://127.0.0.1:8000`; separadamente, a permissão `@connect` deve listar apenas o host local `127.0.0.1`. Não usar `allow_origins=*`.

Este contrato não pressupõe uma porta de host publicada por Docker. Qualquer porta publicada por uma futura configuração Docker deve ser confirmada na configuração de implantação aplicável antes de ser usada pela userscript.

## Validação reproduzível

1. Na raiz do repositório, execute `uv run pytest backend/tests/integration/test_public_import_api.py` para validar o endpoint público, o `201`, os erros `422` e o contrato OpenAPI. A baseline conhecida retorna 12 testes aprovados e 1 falha: o caso com `#ffffff` espera `422`, embora o contrato e o padrão atual aceitem essa cor minúscula. Esta tarefa não modifica backend nem testes para alterar essa baseline.
2. Inicie o backend local com `npm run dev:backend` e consulte `http://127.0.0.1:8000/docs` (ou `http://127.0.0.1:8000/openapi.json`) para conferir `POST /api/imports` e os esquemas `ImportDocumentRequest` e `DocumentResponse` publicados.

## Não objetivos

Este recorte não inclui outros sites, extração genérica, empacotamento como extensão de navegador, sincronização, edição, seleção manual, gerenciamento de importações nem mudanças no contrato da API.
