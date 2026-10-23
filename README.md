# Faturas TIM — execução local no Windows

Consulta as linhas do `config.json` no Meu TIM, baixa o PDF disponível, extrai uma linha digitável com dígitos verificadores válidos e monta mensagens para WhatsApp. Não faz pagamentos nem envia mensagens sozinho.

## Como usar

Requer Windows, **Node.js 22 ou superior** e Microsoft Edge ou Google Chrome instalados.

1. Dê dois cliques em **iniciar.cmd**. Na primeira execução, as dependências são instaladas pelo npm (precisa de internet).
2. Digite a senha Meu TIM no terminal. Ela não aparece enquanto você digita e não fica salva.
3. Aguarde a consulta no navegador. Se houver SMS, captcha ou oferta que impeça o acesso, conclua essa etapa na janela e pressione Enter no terminal quando solicitado.
4. O relatório local abre ao terminar. Confira cada fatura e use **Abrir mensagem no WhatsApp**. Você escolhe o destinatário e toca em Enviar.

Também pode executar pelo terminal, na pasta do projeto:

```powershell
npm.cmd install
npm.cmd start
```

Para conferir o download e a extração mesmo quando as contas estão pagas:

```powershell
npm.cmd start -- --historico
```

Esse modo baixa a fatura paga mais recente quando não há contas abertas e **não gera mensagem para enviá-la**.

## Configuração

As quatro linhas já estão no `config.json`. A linha adicional de final 0959 não é consultada. Se quiser abrir diretamente a conversa do seu avô, preencha `whatsappDestino` com **55 + DDD + número**, somente dígitos. Vazio, o WhatsApp permite escolher o contato.

Cada execução cria `resultados/<data-hora>/` com:

- `index.html`: relatório local e links de mensagem;
- `mensagens.txt`: textos prontos para copiar;
- `resumo.json`: resultados estruturados;
- PDFs quando disponíveis e capturas locais quando uma linha falha.

O relatório é um retrato da consulta. Não existe envio agendado, confirmação de pagamento ou controle de mensagens já enviadas. Uma nova execução pode preparar novamente uma fatura ainda aberta.

## Limites e conferência

Em 23/10/2026, a execução local com `--historico` concluiu o login, a seleção das quatro linhas, o download dos quatro PDFs e a extração de uma linha digitável válida de cada documento. Os quatro testes automatizados também passaram. Como todas as contas consultadas estavam pagas, o fluxo de **fatura em aberto ainda precisa ser validado quando uma estiver disponível**. A interface pode variar por plano: se não reconhecer o botão de detalhes, o programa pede que você abra a fatura correta; se não extrair o código, permite colá-lo para validação. Uma linha que falhar fica pendente, sem bloquear os resultados das outras.

O programa consulta uma fatura por linha em cada execução. Se houver várias contas abertas na mesma linha e a seleção for ambígua, solicita sua intervenção para escolher. O código extraído passa por verificadores matemáticos, que detectam erros de leitura, mas não garantem o beneficiário, valor ou situação do pagamento. Confira esses dados no PDF e no aplicativo do banco.

A primeira versão prioriza a linha digitável do boleto. Pix é reconhecido se estiver disponível em texto com CRC válido; a leitura de QR Code em imagem não está implementada. Não utiliza OCR para adivinhar números.

Credenciais e cookies não são persistidos. Os PDFs, capturas e relatórios contêm dados pessoais e ficam no disco. Esta pasta está dentro do OneDrive: se a sincronização estiver ativa, ela pode sincronizar os resultados. Para manter os arquivos fora da nuvem, mova a pasta do projeto para um diretório local fora do OneDrive.

Se o site mudar, atualize os nomes dos controles em `src/tim.js`. Não há dependência do Codex para executar o projeto.

## Verificações

```powershell
npm.cmd test
```

Os testes verificam extração, dígitos verificadores, rejeição de Pix inválido e bloqueio de mensagens para contas pagas ou resultados ambíguos. A automação usa Playwright com navegador visível e sem perfil persistente.
