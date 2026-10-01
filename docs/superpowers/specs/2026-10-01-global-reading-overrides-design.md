# Correções globais de leitura

## Objetivo

Permitir que uma correção de leitura seja aplicada somente à ocorrência aberta
ou a todas as ocorrências equivalentes da mesma palavra no documento atual.

## Decisões

- O diálogo existente continuará sendo usado.
- Uma checkbox controlará o escopo:
  - desmarcada: salva apenas o intervalo selecionado;
  - marcada: salva a correção em todas as ocorrências com o mesmo
    `VocabularyKey` na revisão atual.
- O `VocabularyKey` é a identidade da palavra analisada. Não serão usados
  apenas o kanji superficial ou um trecho textual, evitando que `私` altere
  ocorrências como `私流`.
- O backend continuará persistindo overrides por ocorrência, preservando o
  contrato atual de resolução e os dados locais já existentes.
- Aplicar globalmente substituirá os overrides equivalentes das ocorrências
  encontradas; ocorrências semanticamente diferentes permanecerão intactas.
- A remoção global usará o mesmo critério de `VocabularyKey`.
- Quando houver mais de uma ocorrência, a interface exibirá a quantidade
  afetada e pedirá confirmação antes da operação global.
- Revisões obsoletas e alterações de conteúdo continuarão protegidas pelas
  mesmas validações atuais.

## Contrato proposto

As operações de salvar e remover receberão um escopo explícito (`local` ou
`vocabulary`) junto da chave da ocorrência. O serviço resolverá o
`VocabularyKey` na análise da revisão e expandirá a operação para as chaves de
intervalo correspondentes. A resposta informará a quantidade de overrides
criados, atualizados ou removidos.

## Validação

- Correção local altera somente uma ocorrência.
- Correção global altera todas as ocorrências equivalentes de `私`.
- Uma palavra composta como `私流` não é alterada pela correção global de `私`.
- Remoção global remove apenas overrides do mesmo `VocabularyKey`.
- Revisão obsoleta continua retornando conflito.
- O frontend envia o escopo correto conforme a checkbox.

## Fora de escopo

- Alterar o analisador morfológico ou o cálculo do `VocabularyKey`.
- Aplicar correções entre documentos.
- Redesign visual completo do leitor; isso será uma etapa posterior com a skill
  `frontend-design`.
