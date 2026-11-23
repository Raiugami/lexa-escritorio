# Lexa

Sistema de gestão para escritório de advocacia: clientes, honorários e parcelas, agenda, fila de ações, financeiro, cobrança de empresas, documentos e relatórios.

## Como rodar

É um único arquivo HTML, sem build nem dependências: abra `index.html` no navegador.
Os dados ficam no `localStorage` do navegador; use a tela **Backup** para exportar e restaurar.

## Estrutura

- `index.html`: o aplicativo (HTML, CSS e JavaScript puro).
- `docs/MAPEAMENTO.md`: levantamento funcional usado como referência e as regras de cálculo.

## Regras de cálculo principais

- Valores guardados em centavos (inteiros) para evitar erro de arredondamento.
- Parcela = (honorários − entrada) ÷ nº de parcelas; a diferença de centavos vai para a última.
- A entrada é lançada como paga na data do cadastro; as parcelas vencem mensalmente a partir do 1º vencimento.
- Situação: pago, parcial, atrasado (vencida e não quitada), a vencer.
- Saldo devedor = total − soma dos pagamentos. Pagamento acima da parcela abate o saldo sem alterar as outras.
- Cobrança de empresas: comissão = recebido × % da empresa; a repassar = recebido − comissão.

## Próximos passos

- Backend com login e banco de dados para uso real e multiusuário.
- Anexos de documentos por cliente.
- Exportação de contratos em .docx.
