# Exceções globais de leitura — persistência e consumo interno

## Objetivo

Criar a infraestrutura persistente para exceções globais de leitura e usá-la
na análise de todos os documentos. A primeira exceção será `私 → わたし`.

Esta entrega altera a leitura efetiva, a leitura de dicionário, a identidade de
vocabulário e a furigana. API de manutenção e interface de usuário serão
entregas posteriores, após a validação deste comportamento interno.

## Escopo

Esta primeira entrega inclui:

- tabela SQLite para exceções globais de leitura;
- exclusão lógica por `deleted_at`;
- carga inicial de `私 → わたし`;
- modelo, contrato de repositório e implementação SQLite somente de leitura;
- resolução das exceções durante a análise;
- versionamento do snapshot das exceções na identidade do cache;
- testes unitários, de persistência e de integração da análise existente.

Esta entrega não inclui:

- endpoints para listar ou manter exceções;
- tela ou rota no frontend;
- migração de seleções de vocabulário ou preferências existentes;
- alterações no contrato de correções de leitura por ocorrência.

## Entregas posteriores

O trabalho seguirá por etapas validadas separadamente:

1. persistência e consumo interno descritos neste documento;
2. API para listar, criar, editar, excluir logicamente e restaurar exceções;
3. tela própria de exceções, baseada nos padrões da tela de tags.

## Modelo de dados

Uma nova migração versionada criará a tabela:

```sql
CREATE TABLE reading_exceptions (
    lemma TEXT PRIMARY KEY,
    reading TEXT NOT NULL,
    deleted_at TEXT
);
```

A mesma migração inserirá a exceção inicial ativa:

```sql
INSERT INTO reading_exceptions (lemma, reading, deleted_at)
VALUES ('私', 'わたし', NULL);
```

Uma linha é ativa quando `deleted_at IS NULL`. Linhas com `deleted_at` preenchido
são preservadas, mas não participam da análise nem da versão do snapshot.

O `lemma` é a identidade estável da exceção. Não serão adicionados nesta fase
campos de descrição, origem, criação ou atualização, pois eles não são
necessários para o consumo interno aprovado.

## Componentes

### Modelo de domínio

`ReadingException` representa um par imutável de `lemma` e leitura. A leitura
ativa deve ser normalizada para hiragana e conter somente kana válidos.

### Repositório

`ReadingExceptionRepository` expõe a listagem das exceções ativas. Nesta fase o
contrato é somente de leitura. `SqliteReadingExceptionRepository` consulta
`reading_exceptions` com `deleted_at IS NULL` e devolve os resultados em ordem
determinística por lemma.

### Resolver

`ReadingExceptionResolver` recebe o snapshot ativo e resolve um `RawToken` por
correspondência exata de lemma. Quando encontra uma exceção, produz um token com
`reading` e `dictionary_reading` substituídos. Superfície, offsets, lemma, classe
gramatical e estado OOV permanecem inalterados.

O analisador Sudachi não acessará o banco e continuará representando apenas o
resultado da análise morfológica externa.

### Serviço de análise

Antes de procurar ou produzir uma análise, `AnalysisService` carrega um snapshot
das exceções ativas e calcula sua versão. Para cada token, o serviço executa:

1. análise morfológica pelo Sudachi;
2. resolução da exceção global pelo lemma;
3. cálculo da `VocabularyKey` com o token corrigido;
4. resolução de eventual override por ocorrência;
5. alinhamento da furigana com a leitura efetiva final.

O resolver global não marca `has_reading_override`. Esse indicador continua
reservado às correções explícitas por ocorrência.

## Precedência e resultado esperado

Sem override por ocorrência, `私` terá:

```text
lemma = 私
reading = わたし
dictionary_reading = わたし
vocabulary_key = ["私","わたし"]
has_reading_override = false
```

Com um override por ocorrência para `あたし`, o resultado terá:

```text
lemma = 私
reading = あたし
dictionary_reading = わたし
vocabulary_key = ["私","わたし"]
has_reading_override = true
```

A correspondência é pelo lemma completo. Uma exceção para `私` não altera um
token cujo lemma seja `私流`.

## Identidade e invalidação do cache

A versão das exceções será um hash determinístico dos pares ativos `(lemma,
reading)`, ordenados por lemma e codificados sem ambiguidade. Essa versão fará
parte de `AnalysisOptions` e, consequentemente, de `AnalysisCacheKey`.

Adicionar, alterar, excluir logicamente ou restaurar uma exceção muda o snapshot
quando o conjunto ativo resultante muda. Análises incompatíveis deixam de ser
encontradas sem exigir a exclusão física de todos os snapshots persistidos.

Restaurar exatamente um snapshot anterior pode reutilizar uma análise criada
com aquele mesmo conteúdo. Esse reaproveitamento é correto porque a identidade
completa da configuração volta a ser a mesma.

## Validação e falhas de dados

As leituras ativas são normalizadas para hiragana e validadas ao construir o
snapshot. Uma entrada ativa vazia ou que não contenha somente kana causa um erro
explícito de configuração durante a análise. O sistema não ignora silenciosamente
uma entrada inválida nem produz furigana ou chaves inconsistentes. Entradas
excluídas logicamente são ignoradas antes da validação.

O registro inicial da migração é válido e confiável. A futura API deverá aplicar
a mesma normalização e validação antes de persistir alterações.

## Compatibilidade de dados existentes

Não haverá migração automática de dados persistidos com a identidade antiga
`["私","わたくし"]`. Seleções de vocabulário e preferências de furigana antigas
podem deixar de corresponder à nova identidade `["私","わたし"]`; o ajuste será
manual quando necessário.

Overrides por ocorrência continuam vinculados a documento, revisão e offsets.
Eles não dependem da leitura de dicionário persistida e mantêm precedência sobre
a exceção global.

## Estratégia de testes

### Migração SQLite

- cria `reading_exceptions` em bancos novos e existentes;
- insere `私 → わたし` como entrada ativa;
- aplica a migração uma única vez ao reabrir o banco;
- preserva as tabelas e dados existentes.

### Repositório

- lista somente entradas ativas;
- ignora linhas com `deleted_at` preenchido;
- retorna ordem determinística para o cálculo da versão;
- preserva corretamente lemma e leitura.

### Resolver

- altera `reading` e `dictionary_reading` de `私`;
- preserva os demais campos do token;
- não altera lemmas diferentes, incluindo `私流`;
- normaliza katakana válido para hiragana;
- rejeita entradas ativas inválidas.

### Serviço de análise e cache

- produz leitura, leitura de dicionário, `VocabularyKey` e furigana corrigidas;
- mantém `has_reading_override = false` para a exceção global isolada;
- dá precedência a override por ocorrência;
- inclui a versão das exceções em `AnalysisOptions`;
- não reutiliza análise com snapshot incompatível após alteração ou exclusão;
- pode reutilizar análise quando a configuração completa retorna a um snapshot
  idêntico anterior.

### Integração

- o endpoint de análise existente retorna `わたし` em `reading` e
  `dictionaryReading` para `私`;
- retorna `VocabularyKey` igual a `["私","わたし"]`;
- retorna furigana baseada em `わたし`;
- não requer endpoint novo nesta fase.

## Critérios de conclusão

- migração, repositório, resolver e integração da análise implementados;
- exceção inicial `私 → わたし` observável pelo endpoint de análise existente;
- precedência de override e isolamento de lemmas comprovados por testes;
- comportamento de cache comprovado para alteração e exclusão lógica;
- testes focados e suíte completa do backend executados;
- `git diff --check` sem problemas introduzidos pela entrega;
- nenhuma alteração de API de manutenção ou frontend incluída.
