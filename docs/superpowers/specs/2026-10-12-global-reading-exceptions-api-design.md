# Exceções globais de leitura — API de manutenção

## Objetivo

Expor uma API administrativa para consultar e manter as exceções globais de
leitura já consumidas pela análise. A API permitirá criar, atualizar, excluir
logicamente e restaurar entradas, sem incluir ainda uma tela no frontend.

O fluxo deve ser simples para o futuro cliente: salvar um lemma por `PUT`
cria, atualiza ou reativa a exceção em uma única chamada. Em particular, um
lemma previamente excluído não deve exigir que o cliente descubra seu estado e
faça uma chamada de restauração antes de salvar a nova leitura.

## Escopo

Esta entrega inclui:

- API HTTP para listar exceções ativas e, opcionalmente, excluídas;
- criação, atualização e reativação idempotentes por lemma;
- exclusão lógica e restauração explícita;
- extensão controlada do repositório SQLite e da implementação em memória;
- validação e normalização de entradas no serviço de domínio;
- testes de contrato HTTP, persistência e observação pela análise existente.

Esta entrega não inclui:

- tela, rota ou chamadas no frontend;
- exclusão física de linhas;
- edição do lemma como operação distinta;
- auditoria, autoria ou histórico de alterações;
- migração de seleções de vocabulário ou preferências existentes.

## Contrato HTTP

As rotas serão incluídas sob o prefixo existente `/api`:

| Método | Rota | Resultado |
| --- | --- | --- |
| `GET` | `/reading-exceptions?includeDeleted=false` | Lista exceções ativas; com `includeDeleted=true`, inclui também as excluídas. |
| `PUT` | `/reading-exceptions/{lemma}` | Cria, atualiza ou reativa a exceção com a leitura recebida. |
| `DELETE` | `/reading-exceptions/{lemma}` | Executa exclusão lógica. |
| `PUT` | `/reading-exceptions/{lemma}/restore` | Restaura uma exceção excluída sem alterar sua leitura. |

O `POST` não será usado. O `PUT` por lemma representa o estado desejado da
exceção e evita um conflito artificial para uma linha que existe apenas como
excluída logicamente.

### Representação

As respostas de item usam o contrato camelCase adotado pelas APIs existentes:

```json
{
  "lemma": "私",
  "reading": "わたし",
  "deletedAt": null
}
```

Uma exceção excluída terá `deletedAt` preenchido com timestamp UTC serializado
no formato padrão do FastAPI. O corpo do `PUT` contém somente a leitura:

```json
{ "reading": "わたし" }
```

O lemma pertence ao caminho. Ele será tratado como texto literal pelo roteador
e validado pelo serviço; o cliente deve aplicar percent-encoding quando a URL
o exigir.

### Códigos de resposta

- `GET`: `200`.
- `PUT /{lemma}`: `201` quando a linha não existia; `200` quando atualiza uma
  entrada ativa ou reativa uma excluída.
- `DELETE /{lemma}`: `200` com a entrada após receber `deletedAt`.
- `PUT /{lemma}/restore`: `200` com a entrada ativa.
- lemma inexistente em `DELETE` ou `restore`: `404`.
- lemma vazio ou leitura ausente, vazia ou inválida: `422`.
- falha de persistência SQLite: `503`, usando o envelope problem-details já
  aplicado pelo backend.

Restaurar uma entrada já ativa é idempotente e retorna `200`, sem modificar a
leitura. Excluir uma entrada já excluída retorna `404`, pois não há uma entrada
ativa a excluir.

## Componentes e fluxo

### Modelos e repositório

`ReadingException` passará a expor `deleted_at: datetime | None`, preservando
o modelo imutável. O repositório oferecerá operações que exprimem o ciclo de
vida da linha:

```python
list(*, include_deleted: bool = False) -> tuple[ReadingException, ...]
put(lemma: str, reading: str) -> tuple[ReadingException, bool]
soft_delete(lemma: str) -> ReadingException | None
restore(lemma: str) -> ReadingException | None
```

O booleano retornado por `put` informa se houve criação física. A implementação
SQLite consulta em ordem determinística por lemma e executa atualização ou
reativação na mesma operação de escrita. Reativar por `put` atualiza a leitura e
limpa `deleted_at`; restaurar explicitamente apenas limpa `deleted_at`.

A implementação em memória manterá a mesma semântica para testes de análise e
de API.

### Serviço de domínio

`ReadingExceptionService` será o ponto único para as regras de negócio. Ele:

1. valida o lemma não vazio;
2. normaliza a leitura para hiragana e garante que seja composta somente por
   kana válidos, reutilizando a regra já aplicada ao snapshot de análise;
3. delega as transições de estado ao repositório;
4. traduz ausência da operação solicitada em erro de domínio que a API mapeia
   para `404`.

O serviço não invalida o cache de análise de forma imperativa. A próxima
análise já lê o snapshot ativo, calcula uma nova versão determinística e deixa
de reutilizar entradas com configuração incompatível.

### Camada HTTP e composição

Um módulo dedicado em `backend/app/reading_exceptions/api.py` conterá o router,
os modelos Pydantic de entrada/saída e a conversão explícita do domínio para o
contrato HTTP. O router será registrado no agregador de rotas existente.

O `create_app` compartilhará uma única instância do repositório e do serviço
entre o router e o `AnalysisService`. Assim, toda escrita fica imediatamente
visível à próxima leitura de snapshot, sem criar fonte de verdade paralela.

## Semântica de estado

| Estado anterior | `PUT /{lemma}` | `DELETE /{lemma}` | `PUT /{lemma}/restore` |
| --- | --- | --- | --- |
| Inexistente | cria ativa (`201`) | `404` | `404` |
| Ativa | atualiza leitura (`200`) | marca `deleted_at` (`200`) | mantém ativa (`200`) |
| Excluída | atualiza leitura e reativa (`200`) | `404` | limpa `deleted_at` (`200`) |

Nenhuma operação exclui fisicamente a linha. O endpoint de listagem retorna
somente ativas por padrão; `includeDeleted=true` existe para administração e
para a futura tela, mesmo que ela inicialmente não o consuma.

## Erros e compatibilidade

Os erros HTTP respeitarão o formato `application/problem+json` já utilizado
pelo backend. A API não usa `409` para uma exceção excluída, pois o `PUT`
resolve esse caso automaticamente.

O contrato de análise existente não muda. Após uma operação que altere o
conjunto ativo, análises futuras refletem a leitura nova graças ao
versionamento de snapshot já implantado. Resultados de análise já retornados
não são alterados retroativamente.

## Estratégia de testes

### Repositórios

- listagem padrão ignora excluídas e `include_deleted` inclui ambas;
- `put` cria, atualiza e reativa uma linha excluída, distinguindo somente a
  criação física;
- exclusão grava timestamp UTC e preserva lemma/leitura;
- restauração limpa apenas `deleted_at`;
- ordem da listagem permanece determinística.

### Serviço

- normaliza katakana para hiragana;
- rejeita lemma vazio, leitura vazia e leitura com caracteres inválidos;
- propaga os casos inexistentes de exclusão e restauração como erros de domínio.

### API

- `GET` padrão e com `includeDeleted=true`;
- `PUT` novo (`201`), atualização (`200`) e reativação (`200`) sem chamada
  adicional;
- `DELETE`, `restore` e restauração idempotente;
- `404`, `422` e `503` no envelope de erro estabelecido;
- serialização camelCase de `deletedAt`.

### Integração

- após criar, alterar, excluir ou restaurar uma exceção pela API, uma análise
  subsequente observa o conjunto ativo apropriado;
- a versão do snapshot continua impedindo reutilização de cache incompatível;
- os testes existentes de análise e de leitura por ocorrência mantêm suas
  garantias de precedência.

## Critérios de conclusão

- API documentada e registrada no aplicativo;
- `PUT` implementa criação, atualização e reativação no mesmo endpoint;
- listagem de excluídas disponível por parâmetro explícito;
- exclusão lógica e restauração cobertas por testes;
- a análise observa alterações posteriores da API sem invalidação manual;
- nenhuma tela ou alteração de frontend incluída;
- testes focados e a suíte relevante do backend executados, com resultados
  reportados separadamente de limitações preexistentes.
