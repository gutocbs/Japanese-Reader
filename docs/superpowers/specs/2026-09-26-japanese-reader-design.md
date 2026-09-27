# Especificação do leitor local de japonês

**Data:** 2026-09-26  
**Status:** proposta consolidada para revisão  
**Escopo:** arquitetura, experiência, contratos e unidades de trabalho do MVP

## 1. Finalidade deste documento

Este documento é a referência principal para desenvolver uma aplicação web local de leitura e estudo de textos em japonês. Ele registra as decisões aprovadas durante o desenho inicial para que o trabalho possa continuar em outra thread sem depender do histórico da conversa.

O documento possui três objetivos centrais:

1. descrever como o sistema deve funcionar e ser estruturado;
2. dividir o desenvolvimento em unidades de trabalho incrementais;
3. resumir o caminho desde o repositório vazio até a conclusão do MVP.

Este é um documento vivo. Ele pode ser estendido quando novas decisões forem aprovadas, mas mudanças de escopo devem ser registradas explicitamente.

## 2. Objetivo do produto

A aplicação será uma ferramenta pessoal, self-hosted, offline-first e executável localmente. Seu propósito principal é permitir a leitura assistida de textos japoneses sem a limitação relativamente pequena de tamanho de documento encontrada em ferramentas similares.

O usuário poderá:

- criar um documento com título e texto japonês;
- processar o texto por meio de análise morfológica local;
- ler o texto preservando exatamente parágrafos, espaços e quebras de linha;
- visualizar furigana sem transformar o conteúdo em canvas, SVG ou imagem;
- marcar vocabulário para revisão posterior;
- revisar a lista de palavras marcadas;
- copiar ou exportar essa lista;
- corrigir manualmente a leitura de uma ocorrência específica;
- salvar, reabrir, editar e excluir documentos em uma biblioteca local.

A primeira versão será prioritariamente desktop. Experiências específicas para celular e tablet não fazem parte do MVP nem estão planejadas atualmente.

## 3. Escopo

### 3.1 Incluído no MVP

- React, TypeScript e Vite no frontend;
- FastAPI e Python no backend;
- SudachiPy com dicionário local;
- biblioteca local de documentos;
- persistência em SQLite;
- renderização semântica de furigana com `ruby` e `rt`;
- seleção de vocabulário por documento;
- preferências de furigana gerais e por vocabulário;
- tamanho configurável da fonte japonesa;
- overrides manuais de leitura por ocorrência;
- cópia ou exportação simples da fila de revisão;
- execução local durante o desenvolvimento;
- empacotamento posterior com Docker Compose;
- testes concentrados no processamento linguístico e na preservação do texto.

### 3.2 Fora do MVP

- autenticação e multiusuário;
- serviços de nuvem e sincronização;
- tradução automática;
- OCR;
- IA ou LLM para resolver leituras;
- spaced repetition;
- consulta a dicionários e criação de cartões, responsabilidades mantidas no Yomitan;
- sincronização automática com Anki;
- integração com AnkiConnect;
- síntese de voz;
- integração com VOICEVOX;
- experiência dedicada para celular e tablet;
- modo escuro, que poderá ser derivado futuramente do tema aprovado.

## 4. Princípios

As decisões devem priorizar:

- funcionamento completamente local;
- simplicidade operacional;
- poucas dependências;
- preservação exata do texto original;
- HTML real, selecionável e acessível;
- compatibilidade com extensões como Yomitan;
- separação entre análise linguística, persistência e apresentação;
- contratos estáveis antes da introdução do SQLite;
- desenvolvimento incremental por resultados observáveis;
- otimização apenas após medições;
- possibilidade de evoluir sem abstrações prematuras.

O sistema não deve ser desenhado para escala, múltiplos usuários, cloud ou microserviços.

## 5. Arquitetura geral

O sistema será um monólito modular com React e FastAPI.

Durante o desenvolvimento existirão dois processos:

```text
Navegador
   |
   +-- Vite dev server -- React
   |          |
   |          +-- /api/* --> proxy local
   |                         |
   +---------------------- FastAPI
                              |
                 +------------+-------------+
                 |            |             |
             Documents     Analysis      Vocabulary
                 |            |             |
                 +------ repository ports --+
                              |
                     Memory primeiro
                     SQLite depois
```

No desenvolvimento:

- frontend e backend serão executados diretamente na máquina;
- o Vite fornecerá atualização rápida;
- o FastAPI executará com reload;
- o proxy do Vite encaminhará `/api` ao backend;
- testes não dependerão de Docker;
- cada processo continuará executável de forma independente.

Na distribuição:

- o frontend será compilado como arquivos estáticos;
- o FastAPI servirá o frontend e a API na mesma origem;
- uma imagem Docker multi-stage conterá a aplicação;
- o Docker Compose iniciará um único serviço;
- um volume persistirá o arquivo SQLite;
- configuração variável ficará em ambiente, com padrões locais seguros.

Docker será implementado depois que o serviço estiver funcional localmente. Ele é um mecanismo de empacotamento e execução, não uma dependência do ciclo diário de desenvolvimento.

## 6. Estrutura prevista do repositório

```text
Japanese.IO/
|-- frontend/
|   |-- src/
|   |   |-- app/                 # composição, rotas e providers
|   |   |-- features/
|   |   |   |-- documents/       # criação, edição e biblioteca
|   |   |   |-- reader/          # texto, ruby e overrides
|   |   |   +-- vocabulary/      # seleção e lista de revisão
|   |   |-- shared/
|   |   |   |-- api/             # cliente HTTP e contratos gerados
|   |   |   +-- ui/              # componentes compartilhados
|   |   +-- styles/
|   +-- tests/
|-- backend/
|   |-- app/
|   |   |-- api/                 # rotas e schemas HTTP
|   |   |-- documents/           # entidade, casos de uso e repository port
|   |   |-- analysis/
|   |   |   |-- morphology.py    # adaptador Sudachi
|   |   |   |-- furigana.py      # alinhamento kanji/kana
|   |   |   |-- models.py        # tokens e segmentos
|   |   |   +-- service.py       # coordenação da análise
|   |   |-- vocabulary/          # chaves, marcações e preferências
|   |   |-- readings/            # overrides por ocorrência
|   |   |-- persistence/
|   |   |   |-- memory/          # primeira implementação
|   |   |   +-- sqlite/          # implementação persistente
|   |   +-- main.py
|   +-- tests/
|-- docs/
|-- scripts/
|-- docker-compose.yml
+-- README.md
```

A estrutura poderá ser ajustada quando o código real demonstrar uma fronteira melhor, desde que as responsabilidades continuem separadas.

## 7. Bibliotecas e escolhas técnicas

### 7.1 Backend

- **FastAPI:** API HTTP, validação e injeção de dependências;
- **Pydantic:** schemas de entrada e saída;
- **SudachiPy:** análise morfológica;
- **SudachiDict Core:** dicionário inicial, com bom equilíbrio entre cobertura e tamanho;
- **pytest:** testes unitários, integração e contratos de repository;
- **sqlite3 da biblioteca padrão:** persistência explícita, sem ORM no MVP.

SQLAlchemy e Alembic não serão adicionados inicialmente. O aplicativo é local e monousuário, e o repository port permite reconsiderar essa decisão sem acoplar o domínio ao acesso a dados.

### 7.2 Frontend

- **React + TypeScript:** aplicação e componentes;
- **Vite:** ambiente de desenvolvimento e build;
- **React Router:** URLs estáveis para biblioteca, edição e leitor;
- **TanStack Query:** estado remoto, cache e invalidação;
- **Vitest + Testing Library:** testes de componentes e interações;
- **OpenAPI TypeScript:** geração dos tipos consumidos pelo frontend.

Redux, Zustand e bibliotecas de estado equivalentes não serão introduzidos sem uma necessidade demonstrada.

### 7.3 Granularidade do Sudachi

O padrão inicial será o **Split Mode B**. O modo C tende a manter compostos longos, enquanto o modo A pode fragmentar excessivamente. A adequação do modo B será validada com textos reais e protegida por testes.

## 8. Modelo de domínio

Os conceitos principais são:

### 8.1 Document

- `id`;
- `title`;
- `content` original e canônico;
- `revision`;
- `createdAt`;
- `updatedAt`;
- `lastReadAt`.

### 8.2 DocumentRevision

Identifica a versão do conteúdo utilizada por análise e overrides. Alterar o conteúdo cria uma nova revisão.

### 8.3 DocumentAnalysis

Resultado derivado identificado por:

- hash do conteúdo;
- versão do analisador;
- versão do dicionário;
- opções de análise.

### 8.4 AnalyzedToken

```ts
type Token = {
  startOffset: number;
  endOffset: number;
  surface: string;
  lemma: string;
  reading: string | null;
  partOfSpeech: string[];
  isOutOfVocabulary: boolean;
  isLexical: boolean;
  vocabularyKey: string | null;
  furiganaSegments: FuriganaSegment[];
};
```

### 8.5 FuriganaSegment

```ts
type FuriganaSegment = {
  text: string;
  reading: string | null;
};
```

Somente segmentos com leitura serão renderizados com `ruby` e `rt`.

### 8.6 VocabularyKey

Identidade normalizada baseada em:

```text
lemma + reading
```

A classe gramatical poderá ser mantida como informação auxiliar, mas não fará parte da chave inicial. Leituras diferentes não serão agrupadas. Identificadores internos do dicionário Sudachi não serão usados como identidade persistente.

### 8.7 VocabularySelection

Marca uma `VocabularyKey` para revisão dentro de um único documento. A seleção não é global na biblioteca.

### 8.8 VocabularyDisplayPreference

Preferência de furigana de uma `VocabularyKey` em um documento:

- `inherit`;
- `show`;
- `hide`.

### 8.9 ReadingOverride

- `documentId`;
- `documentRevision`;
- `startOffset`;
- `endOffset`;
- `reading`.

O override modifica somente uma ocorrência específica.

### 8.10 ReaderPreferences

Preferências de apresentação mantidas no navegador:

- tamanho da fonte japonesa;
- exibição global de furigana.

## 9. Offsets e preservação do texto

Os offsets do contrato serão índices de pontos de código Unicode relativos ao texto original. O backend será a autoridade. O frontend não recalculará offsets usando índices UTF-16 do JavaScript.

Regras obrigatórias:

- `surface` deve corresponder ao trecho original;
- concatenar `FuriganaSegment.text` deve reproduzir exatamente `surface`;
- lacunas entre tokens devem ser obtidas do texto original;
- lemma e leitura nunca substituem a superfície;
- o texto original não será reconstruído a partir dos tokens;
- parágrafos, espaços, tabs e quebras de linha devem ser preservados.

## 10. Pipeline linguístico

```text
Texto original
    |
Segmentação operacional
    |
MorphologicalAnalyzer / Sudachi
    |
Tokens brutos + offsets
    |
Normalização de leitura
    |
VocabularyKey
    |
ReadingOverrideResolver
    |
FuriganaAligner
    |
DocumentAnalysis estruturada
```

Responsabilidades:

1. `MorphologicalAnalyzer` encapsula o Sudachi;
2. leituras katakana do analisador são normalizadas para hiragana no modelo da aplicação;
3. tokens lexicais recebem `VocabularyKey`;
4. `ReadingOverrideResolver` escolhe a leitura efetiva;
5. `FuriganaAligner` produz segmentos renderizáveis;
6. a análise mantém offsets absolutos.

O primeiro slice poderá processar o documento inteiro, mas a abstração aceitará regiões com offset-base para permitir divisão futura em blocos.

## 11. Alinhamento de furigana

O alinhador será conservador:

- kana puro não recebe furigana;
- katakana puro não recebe furigana;
- kanji puro recebe a leitura sobre a unidade lexical;
- em kanji com okurigana, kana coincidente serve como âncora;
- katakana pode ser normalizado para comparação sem alterar a superfície;
- quando mais de um alinhamento for plausível, não será inventada uma precisão falsa;
- quando necessário, a leitura será aplicada à unidade lexical completa;
- quando nem isso for confiável, a superfície será preservada sem furigana e o caso será diagnosticado.

Exemplo:

```text
surface: 食べた
reading: たべた

食 -> た
べた -> sem furigana
```

Perfeita desambiguação contextual não é meta do MVP. Casos incorretos poderão ser corrigidos manualmente.

## 12. Contratos HTTP

Os contratos serão definidos antes do SQLite e usados pelo repository em memória:

- `POST /api/documents` — cria documento;
- `GET /api/documents` — lista biblioteca;
- `GET /api/documents/{id}` — abre documento;
- `PUT /api/documents/{id}` — altera título ou conteúdo;
- `DELETE /api/documents/{id}` — remove documento;
- `POST /api/documents/{id}/analysis` — analisa a revisão atual;
- `GET/PUT /api/documents/{id}/vocabulary-selections` — consulta ou altera marcações;
- endpoints de preferências de furigana por vocabulário;
- endpoints de criação, leitura e remoção de overrides.

Nem todos os endpoints precisam ser implementados na primeira unidade. Porém, os modelos e invariantes devem impedir que a introdução do SQLite exija reescrever o contrato.

Criar ou atualizar um documento transmite seu conteúdo uma vez. Interações posteriores referenciam `documentId`, revisão, offsets ou `VocabularyKey`.

## 13. Edição e invalidação

Quando o conteúdo de um documento mudar:

- a revisão será incrementada;
- a análise anterior será invalidada;
- os overrides de leitura serão removidos após confirmação do usuário;
- seleções por `VocabularyKey` serão preservadas;
- preferências de furigana por `VocabularyKey` serão preservadas;
- uma nova análise será necessária.

Preferências cuja chave deixe de aparecer poderão permanecer armazenadas sem aparecer no leitor. Limpeza de registros órfãos não é necessária no primeiro MVP.

## 14. Experiência e interface

### 14.1 Direção geral

- desktop-first;
- minimalista e focada em leitura;
- tema claro denominado **Verde silencioso**;
- cinza frio como superfície;
- verde profundo como ação e estado principal;
- marcação suave sem competir com furigana;
- tema escuro derivável no futuro, fora do MVP;
- tipografia japonesa apropriada e line-height confortável.

As cores finais deverão ser convertidas em tokens semânticos e validadas para contraste AA.

### 14.2 Estrutura do leitor

A estrutura aprovada possui:

- cabeçalho discreto;
- título do documento;
- texto em uma única coluna de leitura;
- lista vertical de revisão abaixo do texto;
- uma linha por vocabulário, contendo lemma, leitura e remoção;
- sem painel lateral persistente.

Para documentos longos, uma indicação compacta da quantidade de palavras marcadas poderá apontar para a lista sem mantê-la aberta ao lado.

### 14.3 Seleção

- clique simples marca ou desmarca uma `VocabularyKey`;
- todas as ocorrências equivalentes no documento refletem a marcação;
- cor não será o único indicador visual;
- a lista vertical acompanha o estado;
- remover pela lista desmarca a chave.

### 14.4 Menu de contexto

Cada token lexical será focável e oferecerá:

- clique direito para abrir o menu;
- `Shift+F10` ou tecla Menu como alternativa de teclado;
- `Esc` para fechar e restaurar o foco.

O menu conterá:

- corrigir leitura;
- remover correção, quando houver;
- sempre mostrar furigana;
- ocultar furigana;
- seguir configuração geral.

O menu customizado só será aberto sobre tokens lexicais. A aplicação não tentará substituir genericamente o menu do navegador.

### 14.5 Preferências de leitura

O menu do leitor conterá:

- controle de tamanho da fonte japonesa;
- alternância global de furigana.

A precedência da exibição será:

```text
preferência da VocabularyKey
    -> preferência global do leitor
    -> padrão do aplicativo
```

Ocultar furigana não remove leituras, segmentos ou overrides do modelo.

### 14.6 Fluxos

**Biblioteca:** documentos ordenados por `lastReadAt`, com criar, abrir, editar e excluir. Exclusão exige confirmação.

**Novo documento/edição:** título, textarea amplo e ação de processamento. Enquanto o repository for em memória, um aviso de desenvolvimento explicará a limitação.

**Processamento:** botão desabilitado durante a operação, feedback de progresso e preservação integral do formulário em caso de erro.

**Leitor:** título, editar, voltar à biblioteca, texto com furigana e lista de revisão.

**Override:** formulário contextual mostra superfície, leitura atual e nova leitura em kana. O backend valida e normaliza.

**Cópia/exportação:** formato textual inicial simples e determinístico.

## 15. Persistência SQLite

O esquema inicial prevê:

- `documents`;
- `document_analyses`;
- `vocabulary_selections`;
- `vocabulary_display_preferences`;
- `reading_overrides`;
- `schema_migrations`.

Tokens derivados poderão ser persistidos inicialmente como JSON associado à análise, em vez de milhares de linhas. Essa hipótese deve ser medida com documentos grandes antes de se tornar definitiva.

SQLite será acessado por repositories. A implementação em memória e a implementação SQLite devem passar pelo mesmo conjunto de testes de contrato.

O banco ficará em volume Docker persistente quando o empacotamento for criado.

## 16. Cache de análise

Uma análise armazenada só poderá ser reutilizada quando coincidirem:

```text
contentHash
analyzerVersion
dictionaryVersion
analysisOptions
```

Ao abrir um documento:

1. o backend procura análise compatível;
2. se existir, devolve o resultado derivado;
3. caso contrário, executa uma nova análise;
4. análises antigas podem ser descartadas sem perda de dados canônicos.

## 17. Documentos grandes

Não haverá limite arbitrário pequeno de caracteres.

Decisões desde o início:

- conteúdo não será reenviado a cada interação;
- análise será endereçada por documento e revisão;
- respostas serão organizáveis em blocos com offsets absolutos;
- parágrafos serão fronteiras naturais;
- React receberá blocos, não estado por caractere;
- seleções serão conjuntos de `VocabularyKey`;
- preferências não dispararão nova análise;
- virtualização só será introduzida após medição.

O primeiro slice poderá devolver toda a análise em uma resposta. Antes de afirmar suporte confortável a documentos muito grandes, serão medidos:

- tempo de análise;
- tamanho do JSON;
- memória do backend;
- tempo até a primeira renderização;
- latência das interações;
- compatibilidade de seleção de texto e Yomitan.

Se necessário, o contrato poderá evoluir para:

```text
POST /documents/{id}/analysis
GET  /documents/{id}/analysis/status
GET  /documents/{id}/analysis/blocks?after=...
```

As otimizações possíveis incluem processamento em blocos, cache, análise assíncrona e virtualização. Somente o gargalo comprovado será tratado.

## 18. Estados e erros

- documento vazio: processamento desabilitado com instrução próxima ao campo;
- falha do Sudachi: mensagem recuperável sem perda do texto;
- token sem leitura: superfície preservada, sem furigana inventado;
- alinhamento incerto: fallback conservador e diagnóstico;
- análise obsoleta: tokens antigos não serão misturados com conteúdo novo;
- edição de conteúdo: confirmação sobre remoção de overrides;
- documento ausente: caminho claro de volta à biblioteca;
- erro do SQLite: a interface informa que a alteração não foi salva;
- operação longa: feedback visível e, quando houver processamento assíncrono, cancelamento;
- falhas nunca devem apagar silenciosamente o texto digitado.

## 19. Estratégia de testes

### 19.1 Processamento linguístico

`MorphologicalAnalyzer`:

- kana;
- kanji;
- katakana;
- números;
- latim;
- pontuação;
- formas conjugadas;
- lemma;
- palavras desconhecidas;
- offsets e `raw_surface`;
- múltiplos parágrafos, espaços, tabs e quebras;
- versão e configuração do dicionário.

`FuriganaAligner`:

- kanji puro;
- kanji com okurigana;
- múltiplos blocos de kanji/kana;
- âncoras de kana;
- comparação normalizada de katakana;
- leituras irregulares;
- ambiguidades;
- fallback conservador;
- preservação exata da superfície.

`VocabularyKey`:

- convergência de formas conjugadas;
- separação de leituras diferentes;
- ausência de chave em tokens não lexicais.

`ReadingOverrideResolver`:

- precedência do override;
- alteração somente da ocorrência correta;
- invalidação por nova revisão;
- rejeição segura de entrada inválida.

### 19.2 Integração do backend

- preservação do texto após serialização;
- criação e análise em memória;
- incremento de revisão;
- preservação de marcações e preferências após edição;
- remoção dos overrides após edição;
- testes de contrato iguais para memória e SQLite;
- reutilização correta do cache.

### 19.3 Frontend

- renderização semântica de `ruby` e `rt`;
- texto-base preservado ao ocultar furigana;
- seleção compartilhada por chave;
- menu de contexto e teclado;
- restauração de foco;
- lista vertical;
- estados vazio, carregando, falha e obsoleto;
- preferências gerais após reload;
- texto selecionável.

### 19.4 Validação exploratória

- uso real com Yomitan;
- documentos de tamanho crescente;
- navegação por teclado;
- contraste e zoom;
- Chrome, Edge e Firefox desktop atuais;
- reinício do backend;
- persistência após recriar container.

### 19.5 Invariantes

```text
texto exibido == texto original
offsets não se sobrepõem nem removem conteúdo
segmentos de furigana preservam a superfície
dados derivados nunca substituem o texto canônico
```

Não será perseguida uma porcentagem artificial de cobertura.

## 20. Riscos técnicos

### 20.1 Alinhamento de furigana

O Sudachi fornece a leitura da unidade, não o alinhamento exato entre cada kanji e cada mora. Nomes, ateji, jukujikun e leituras irregulares podem ser ambíguos.

**Mitigação:** alinhamento conservador, fallback, testes isolados e override manual.

### 20.2 Mudanças do dicionário

Atualizações podem alterar tokenização, lemma e leitura.

**Mitigação:** versões fixadas, versão registrada na análise e cache descartável.

### 20.3 Palavras desconhecidas

Tokens OOV podem ter dados incompletos.

**Mitigação:** preservar superfície e permitir ausência explícita de leitura/chave.

### 20.4 Fronteiras de blocos

Dividir texto pode mudar a análise próxima às fronteiras.

**Mitigação:** começar pelo documento completo; ao dividir, usar fronteiras lógicas e testes comparativos.

### 20.5 Offsets Python e JavaScript

Python e JavaScript indexam strings de formas diferentes em alguns caracteres.

**Mitigação:** contrato em pontos de código e autoridade no backend.

### 20.6 Virtualização e extensões

Virtualização pode remover trechos do DOM e prejudicar seleção de texto e Yomitan.

**Mitigação:** medir primeiro e revalidar compatibilidade após qualquer otimização.

### 20.7 Menu de contexto

Um menu customizado pode competir com comportamentos nativos ou extensões.

**Mitigação:** interceptar somente tokens lexicais, oferecer teclado e validar com Yomitan.

## 21. Unidades de trabalho

### Unidade 0 — Fundação e contratos

**Objetivo:** estabelecer os projetos, contratos e comandos locais.

**Entregas:**

- React/TypeScript/Vite;
- FastAPI;
- modelos HTTP, offsets, revisão e `VocabularyKey`;
- `DocumentRepository` em memória;
- tipos TypeScript gerados do OpenAPI;
- testes, lint e comandos locais;
- documentação para iniciar sem Docker.

**Aceite:** documento criado e recuperado em memória pelo contrato definitivo.

### Unidade 1 — Menor vertical slice de leitura

**Objetivo:** atravessar todo o sistema com um texto real.

```text
texto -> documento em memória -> Sudachi -> JSON -> React -> ruby
```

**Entregas:**

- integração Sudachi;
- tokens e offsets;
- primeira versão do alinhador;
- preservação estrutural;
- leitor semântico;
- testes dos invariantes.

**Aceite:** o texto de exemplo percorre o sistema e é reproduzido exatamente.

### Unidade 2 — Robustez linguística

**Objetivo:** tornar o processamento confiável nos casos relevantes.

**Entregas:**

- alinhamento kanji/kana ampliado;
- corpus de regressão;
- OOV e fallbacks;
- versões do analisador/dicionário;
- validação do Split Mode B.

**Aceite:** casos aprovados passam sem alteração da superfície ou precisão inventada.

### Unidade 3 — Seleção e fila de revisão

**Objetivo:** produzir a lista de vocabulário a revisar.

**Entregas:**

- clique por `VocabularyKey`;
- atualização de todas as ocorrências;
- lista vertical;
- remoção;
- cópia textual;
- repository em memória.

**Aceite:** ocorrências equivalentes no documento compartilham seleção.

### Unidade 4 — Preferências do leitor

**Objetivo:** permitir ajustar apresentação e furigana.

**Entregas:**

- tamanho de fonte;
- furigana global;
- `inherit/show/hide` por chave;
- preferências gerais no navegador;
- menu de contexto acessível.

**Aceite:** precedência funciona sem nova análise ou alteração do texto.

### Unidade 5 — Overrides manuais

**Objetivo:** corrigir a leitura de uma ocorrência.

**Entregas:**

- interação por mouse e teclado;
- formulário de leitura;
- resolver antes do alinhador;
- persistência por revisão e offsets;
- remoção da correção;
- confirmação de edição.

**Aceite:** somente a ocorrência corrigida muda; editar conteúdo remove overrides e preserva seleções.

### Unidade 6 — Biblioteca completa em memória

**Objetivo:** concluir os fluxos de documentos antes do SQLite.

**Entregas:**

- tela de biblioteca;
- criar, abrir, renomear, editar e excluir;
- ordenação por `lastReadAt`;
- rotas estáveis;
- estados vazios e erros.

**Aceite:** a biblioteca inteira funciona, com perda esperada após reiniciar o backend.

### Unidade 7 — Persistência SQLite

**Objetivo:** tornar a biblioteca durável sem mudar contratos.

**Entregas:**

- esquema e migrações;
- repositories SQLite;
- testes de contrato compartilhados;
- cache de análise;
- invalidação por hash e versões;
- recuperação após reinício.

**Aceite:** a implementação muda por configuração, sem alterações de API, casos de uso ou componentes.

### Unidade 8 — Validação de documentos grandes

**Objetivo:** medir e eliminar gargalos comprovados.

**Entregas:**

- corpus sintético progressivo;
- métricas de backend, transporte e browser;
- identificação do primeiro gargalo;
- otimização mínima necessária;
- nova validação com Yomitan.

**Aceite:** limites e desempenho são documentados com evidências.

### Unidade 9 — Empacotamento Docker

**Objetivo:** entregar execução self-hosted reprodutível.

**Entregas:**

- build multi-stage;
- serviço único;
- volume SQLite;
- healthcheck;
- ambiente configurável;
- teste de reinício e recuperação.

**Aceite:** `docker compose up -d` inicia a aplicação e a biblioteca sobrevive à recriação do container.

### Unidade 10 — Acabamento do MVP

**Objetivo:** concluir qualidade, documentação e usabilidade.

**Entregas:**

- aplicação visual do tema Verde silencioso;
- loading e erros;
- acessibilidade e contraste;
- testes desktop;
- README de instalação, backup e atualização;
- exportação simples da fila.

**Aceite:** fluxo principal documentado e utilizável do início ao fim.

## 22. Resumo do caminho de execução

O desenvolvimento parte de um diretório vazio e termina em um serviço local persistente e empacotado.

### Fase A — Estabelecer a base

1. criar os projetos frontend e backend;
2. registrar contratos e invariantes;
3. implementar o repository em memória;
4. configurar testes e execução local.

**Resultado:** estrutura pronta sem dependência de Docker ou SQLite.

### Fase B — Provar a experiência principal

1. enviar texto ao backend;
2. analisar com Sudachi;
3. devolver tokens e segmentos;
4. renderizar HTML semântico com furigana;
5. preservar exatamente o original.

**Resultado:** menor vertical slice funcional.

### Fase C — Tornar a leitura útil

1. robustecer tokenização e alinhamento;
2. adicionar seleção por vocabulário;
3. construir a fila vertical;
4. adicionar preferências de fonte e furigana;
5. permitir overrides manuais.

**Resultado:** leitor pessoal utilizável, ainda em memória.

### Fase D — Completar o gerenciamento

1. concluir a biblioteca;
2. implementar CRUD e navegação;
3. validar edição e invalidação;
4. substituir memória por SQLite;
5. armazenar cache derivado de forma segura.

**Resultado:** biblioteca persistente sem mudança dos contratos iniciais.

### Fase E — Validar escala local

1. medir documentos progressivamente maiores;
2. localizar o gargalo real;
3. aplicar a menor otimização necessária;
4. revalidar seleção de texto, acessibilidade e Yomitan.

**Resultado:** suporte documentado a textos grandes, baseado em evidências.

### Fase F — Empacotar e finalizar

1. criar a imagem multi-stage;
2. montar o volume SQLite;
3. validar reinícios e backups;
4. concluir identidade visual e acessibilidade;
5. publicar documentação de uso e manutenção.

**Resultado:** MVP iniciado com `docker compose up -d`, totalmente local e persistente.

## 23. Critério global de conclusão do MVP

O MVP estará concluído quando:

- o usuário puder criar, salvar, reabrir, editar e excluir documentos;
- o texto for analisado localmente e exibido sem perda estrutural;
- furigana for semântico, configurável e corrigível por ocorrência;
- vocabulário puder ser marcado por documento e copiado/exportado;
- preferências de leitura funcionarem como especificado;
- SQLite sobreviver ao reinício do serviço e do container;
- textos grandes tiverem comportamento medido e limites documentados;
- Yomitan continuar funcionando sobre texto HTML real;
- testes críticos estiverem passando;
- a aplicação puder ser iniciada localmente sem Docker durante o desenvolvimento e por Docker Compose na distribuição.

## 24. Evoluções futuras

### 24.1 AnkiConnect

Antes da implementação, será necessário investigar:

- consulta de notas existentes;
- decks e note types;
- mapeamento configurável de campos;
- comparação entre campos do Anki e `VocabularyKey`;
- comportamento quando usuários usam nomes de campos distintos.

Yomitan continuará responsável por dicionário e criação de cartões.

### 24.2 TTS

Quando iniciado, o sistema deverá introduzir um contrato de provider, por exemplo:

```text
TtsProvider
- getAvailableVoices()
- synthesize(text, voice, settings)
- healthCheck()
```

VOICEVOX poderá implementar esse contrato. Textos grandes deverão ser divididos por sentenças ou parágrafos, e cada áudio deverá manter vínculo com offsets do documento para progresso, retry, cache e retomada.

Nenhuma abstração de Anki ou TTS será criada no código do MVP antes de essa funcionalidade começar.

## 25. Referências técnicas

- SudachiPy: <https://worksapplications.github.io/sudachi.rs/python/>
- API de morfemas do SudachiPy: <https://worksapplications.github.io/sudachi.rs/python/api/sudachipy.html>
- FastAPI Dependencies: <https://fastapi.tiangolo.com/tutorial/dependencies/>
- Vite production build: <https://vite.dev/guide/build>
- SQLite isolation: <https://www.sqlite.org/isolation.html>

