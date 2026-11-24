# Honra

**HONRA**: Honorários, Organização, Negócios, Recebimentos e Agenda.

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

## Google Agenda

- Cada compromisso tem o botão **+ Google**, que abre o Google Agenda já preenchido.
- **Exportar agenda** baixa um arquivo `.ics` que o Google Agenda, o Outlook e o iPhone importam.
- **Sincronização nos dois sentidos:** em Agenda, "Configurar sincronização", cole o ID de cliente OAuth do Google Cloud e clique em "Entrar com Google". Compromissos criados, editados ou apagados de um lado aparecem do outro (janela de 60 dias para trás até cerca de 1 ano para frente).

### Como criar o ID de cliente no Google Cloud

1. Em console.cloud.google.com, crie um projeto (ex.: "Honra").
2. Em "APIs e serviços" → "Biblioteca", ative a **Google Calendar API**.
3. Em "Tela de consentimento OAuth", escolha "Externo", preencha nome do app e e-mail, adicione o escopo `.../auth/calendar.events` e, enquanto estiver em teste, adicione os e-mails que vão usar em "Usuários de teste".
4. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth" → tipo "Aplicativo da Web". Em "Origens JavaScript autorizadas" coloque `https://raiugami.github.io`.
5. Copie o ID (termina em `.apps.googleusercontent.com`) e cole no Honra.

Para abrir para qualquer pessoa (fora da lista de teste), o Google pede a verificação do app, porque o acesso à agenda é um escopo sensível.
