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

## Aparência personalizável

Em **Ajustes › Aparência** cada escritório escolhe a cor principal (com cores prontas ou qualquer cor), envia o logo completo e um ícone para o menu recolhido, e define o nome que aparece no topo. O sistema ajusta o tom da cor para manter o texto legível no tema claro e no escuro. A aparência fica salva junto com os dados e entra no backup.

O sistema também tem tema claro, escuro ou automático (segue o aparelho), no botão do rodapé do menu.

## Celular

No celular o sistema usa uma barra de ícones embaixo, tabelas em formato de cartão e um botão "+" com ações rápidas. Pelo navegador do celular dá para instalar o sistema na tela inicial ("Adicionar à tela inicial"), e ele abre como um app, mesmo sem internet.
