# Exceções globais de leitura — tela de gerenciamento

## Objetivo

Entregar uma página própria para administrar as exceções globais de leitura já
suportadas pela API. A página permite consultar exceções ativas, criar uma
nova, alterar sua leitura e removê-la logicamente.

A administração ficará fora de Configurações e seguirá a linguagem visual e de
interação da página de Etiquetas. A primeira versão não expõe itens excluídos
nem restauração, embora a API continue a suportá-los.

## Escopo

Esta entrega inclui:

- rota frontend `/reading-exceptions`;
- link de navegação principal “Exceções de leitura”;
- página para listar somente exceções ativas;
- criação por lemma e leitura;
- edição inline da leitura;
- confirmação antes da exclusão lógica;
- integração com a API existente e seus tipos OpenAPI gerados;
- estados de carregamento, vazio, erro, sucesso e operação pendente;
- testes de interface, cliente, rota e acessibilidade.

Esta entrega não inclui:

- listagem, filtro ou restauração de entradas excluídas;
- exclusão física;
- edição de lemma;
- busca, paginação, ordenação configurável ou importação em lote;
- alterações à API, à análise, ao cache ou à precedência de overrides locais;
- mudança da tela de Configurações.

## Navegação e composição

`AppRouter` reconhecerá `/reading-exceptions` e renderizará
`ReadingExceptionsPage`. O cabeçalho da aplicação terá um terceiro link,
“Exceções de leitura”, ao lado de Etiquetas e Configurações. Ele usará o mesmo
padrão de link acessível, inclusive `aria-current="page"` para a rota ativa.

A página será independente de `TagManagementPage`, mas reutilizará seus
padrões de layout, hierarquia e CSS. Seletores novos serão prefixados para não
alterar o comportamento ou aparência da página de Etiquetas.

## Página e interação

A página terá o título “Exceções de leitura”, uma descrição curta do efeito
global das entradas e um formulário superior com:

- campo `Lemma`;
- campo `Leitura`;
- botão “Adicionar exceção”.

O envio ficará indisponível enquanto um dos campos estiver vazio ou uma
operação de salvamento estiver em curso. A página não duplicará a validação
canônica de kana: ela enviará a leitura à API, que normaliza e valida a entrada
como fonte de verdade.

A lista mostra somente os resultados padrão de `GET /api/reading-exceptions`,
em sua ordem fornecida pelo backend. Cada item mostra lemma e leitura, com
ações “Editar” e “Remover”.

Ao editar, apenas a leitura se torna um campo editável na própria linha. “Salvar”
executa o mesmo `PUT /api/reading-exceptions/{lemma}` usado para criar; o lemma
permanece imutável. “Cancelar” descarta a alteração local sem chamar a API.

Remover abre um diálogo de confirmação acessível. O texto esclarece que a
exceção deixará de ser aplicada às próximas análises. Confirmar executa
`DELETE /api/reading-exceptions/{lemma}`; cancelar, Escape e retorno de foco
seguem o padrão do diálogo de remoção de Etiquetas.

## Dados e cliente HTTP

`DocumentClient` receberá métodos tipados para:

- listar exceções ativas;
- criar, atualizar ou reativar uma exceção por lemma e leitura;
- excluir logicamente uma exceção por lemma.

Os tipos devem vir de `frontend/src/shared/api/generated.ts`; a camada de
cliente não reimplementará o contrato HTTP. A página usará React Query para
carregar a lista e invalidará a query após operações concluídas com sucesso.

O cliente não chama `includeDeleted=true` e não usa a rota de restauração nesta
entrega.

## Estados e acessibilidade

- Carregamento: mensagem de status de carregamento.
- Lista vazia: mensagem direta que convida a criar a primeira exceção.
- Indisponibilidade de listagem: alerta com botão de tentar novamente.
- Sucesso: mensagem com `role="status"` e `aria-live="polite"`.
- Falha de operação: mensagem com `role="alert"`; quando a API retornar
  problem-details, seu detalhe é exibido sem supor que todo erro seja kana.
- Pendente: controles da operação ficam desabilitados para impedir duplicação.
- Diálogo de remoção: `role="dialog"`, título e descrição associados, foco
  inicial no diálogo e retorno ao botão que o abriu ao cancelar.

## Mensagens

As mensagens de sucesso serão objetivas:

- “Exceção adicionada.”
- “Exceção atualizada.”
- “Exceção removida.”

Para falhas sem problem-details legível, a página apresenta uma mensagem neutra
específica da operação. Não anuncia uma causa de validação que o backend não
tenha confirmado.

## Estratégia de testes

### Cliente e tipos

- métodos usam os caminhos e verbos da API existentes;
- payload de criação/edição contém apenas `reading`;
- tipos gerados são consumidos, sem definição manual duplicada.

### Página e rota

- link principal navega para `/reading-exceptions` e indica rota ativa;
- carrega e mostra apenas a lista ativa recebida do cliente;
- exibe estado vazio e permite nova tentativa após erro de listagem;
- cria, edita e remove uma exceção, invalidando/refazendo a lista;
- cancelamento de edição não chama a API;
- exclusão requer confirmação; Escape fecha o diálogo e restaura foco;
- falhas de API preservam o detalhe problem-details quando disponível;
- controles ficam desabilitados durante operações pendentes;
- mensagens de sucesso e erro têm os papéis acessíveis adequados.

### Regressão

- testes focados da página, cliente e roteamento;
- suíte frontend;
- build de produção do frontend;
- `git diff --check`;
- validação visual manual da rota em estado vazio, populado, edição e remoção
  permanece uma evidência separada de build e testes automatizados.

## Critérios de conclusão

- a navegação principal contém uma rota descoberta para Exceções de leitura;
- o usuário gerencia o catálogo ativo completo sem entrar em Configurações;
- criação, edição e exclusão chamam apenas os endpoints acordados;
- nenhuma entrada excluída ou restauração é mostrada na interface;
- erro e acessibilidade seguem os padrões já estabelecidos;
- OpenAPI/tipos existentes são reutilizados sem alteração manual;
- testes e build relevantes executados, com limitações ambientais reportadas
  separadamente;
- nenhuma alteração no backend, análise ou cache é introduzida.
