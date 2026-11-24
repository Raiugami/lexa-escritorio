# Mapeamento funcional do HonoráriosPro (referência)

Testado em 23/11/2026 numa conta de teste, com um cliente fictício ("TESTE CLAUDE (pode apagar)").
Serve só como referência de **funcionalidade**. Nossa versão não reutiliza marca, textos nem visual.

## Visão geral
SaaS de gestão de escritório de advocacia (não é calculadora). Menu:
Início · Novo Cliente · Clientes · Clientes em Atraso · Clientes Arquivados (quitados) · Aniversariantes · Agenda · Ações para Ajuizar · Cobrança para Empresas · Financeiro · Assinatura · Relatórios · Meus Dados.

## Início (painel)
- Saudação, data/hora.
- Cards: total de clientes, a receber no mês, recebido no mês, clientes em atraso (valores ocultos até clicar "Mostrar valores").
- Botão "Recebimento avulso".
- Próximos compromissos, ações para ajuizar pendentes, atalhos, mini-calendário que leva à agenda do dia.

## Cadastro de cliente
- Dados pessoais: nome, nascimento, telefone, CPF, RG, nacionalidade, estado civil (Solteiro, Casado, Divorciado, Viúvo, União Estável), profissão, e-mail, renda mensal.
- Área: Cível, Criminal, Previdenciário, Trabalhista, Ambiental, Administrativo, Execução da Pena.
- Endereço: logradouro, nº, bairro, cidade, UF, CEP.
- Honorários:
  - **Valor fixo**: valor total, entrada, À vista | Parcelado, nº de parcelas, valor da parcela (calculado, somente leitura), 1º vencimento.
  - **Por êxito**: apenas percentual (%).
- Confirmação da data do 1º vencimento antes de salvar.

### Regras de cálculo observadas
- Campos monetários com máscara: dígitos digitados viram centavos (digitar 10000 → R$ 100,00).
- `valor_parcela = (honorários − entrada) / nº_parcelas`.
- Ao salvar: cria a parcela **ENTRADA** com vencimento hoje e já **paga**; cria N parcelas mensais a partir do 1º vencimento (mesmo dia nos meses seguintes).
- Situação da parcela: **Pago** (pago ≥ valor), **Parcial** (0 < pago < valor), **Atrasado** (vencida e não quitada), **Pendente** (a vencer).
- Dar baixa: informa o valor recebido (padrão = valor da parcela). Se for maior que a parcela, o excedente só abate o **saldo devedor total**, sem mexer nas outras parcelas.
- `saldo_devedor = total_honorários − soma(valores pagos)`.
- Parcela paga pode ser "corrigida"; parcela com pagamento tem botão de recibo.
- Cliente com todas as parcelas pagas vai para "Arquivados/Quitados" automaticamente.

## Detalhe do cliente
Dados, resumo financeiro, anexar documentos, documentos do cliente, editar, tabela de parcelas (vencimento, valor, valor pago, situação, observação, ações: dar baixa, recibo, corrigir).

## Gerar contrato
Pré-preenche os dados do cliente; só pede **tipo de ação**. Tipo de honorário: Parcelado | Quota litis (êxito). Foro (cidade/UF), valor, entrada, parcelas, 1º vencimento.
Gera um .docx com **contrato de honorários + procuração + declaração de hipossuficiência**, após o advogado marcar ciência de que deve revisar o modelo. (Não gerei o arquivo; o conteúdo dos modelos será nosso.)

## Clientes em atraso / Arquivados / Aniversariantes
Listas filtradas: parcelas vencidas não pagas; clientes quitados; aniversariantes do mês.

## Agenda
Compromisso: título*, descrição, data*, hora*. Filtros: Todos | Esta semana.

## Ações para ajuizar
Fila de entrada: cliente*, tipo*, descrição, data de entrada*, prioridade (Normal, Média, Alta).

## Financeiro
Abas: Visão geral, A receber, Recebidos, Inadimplência, Clientes por êxito. Filtro por período (mês).
Cards: recebido no mês, a receber no mês, em atraso, a vencer em 30 dias. Gráfico de fluxo de caixa dos últimos 6 meses (realizado × previsto).
Nova parcela avulsa: cliente*, valor*, vencimento*.

## Cobrança para empresas (módulo de recuperação de crédito)
- Empresas contratantes: razão social*, CNPJ, contato, telefone, e-mail, endereço, **% comissão de êxito***, observações.
- Devedores: empresa*, nome*, CPF/CNPJ, telefone, e-mail, endereço, observações.
- Acordos: empresa*, devedor*, data, valor total*, entrada, data da entrada, nº de parcelas do restante*, 1º vencimento*, observações, anexos. Gera as parcelas automaticamente.
- Acompanhamento, Radar de atrasados (devedores, parcelas e valor em atraso), Arquivados (acordos concluídos).
- Repasses: total recebido, `comissão = recebido × %comissão`, `a repassar = recebido − comissão`, resumo por empresa. Valores recebidos não entram no faturamento do escritório (só a comissão, após confirmação).

## Relatórios (PDF)
Extrato financeiro (período + status: pendente, parcial, pago, atrasado), lista de clientes, clientes em atraso, clientes por êxito.

## Meus dados
Dados do advogado usados nos documentos: nome, e-mail, OAB, CPF, RG, nacionalidade, estado civil, telefone, endereço do escritório, chave Pix.

## Assinatura (do próprio SaaS)
Mensalidade = 4,68% do salário mínimo (R$ 75,90 em 11/2026), cartão ou Pix. Não se aplica à nossa versão.
