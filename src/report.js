import { writeFile } from 'node:fs/promises';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function messageFor(result) {
  const codes = result.boletos ?? [];
  const pix = result.pix ?? [];
  if (result.status !== 'aberta' || (codes.length !== 1 && pix.length !== 1)) return '';
  return ['Vô, segue a conta da TIM.', `Linha: ${result.linha}`, result.valor && `Valor: ${result.valor}`,
    result.vencimento && `Vencimento: ${result.vencimento}`,
    codes.length === 1 ? `Código de barras:\n${codes[0]}` : `Pix copia e cola:\n${pix[0]}`].filter(Boolean).join('\n\n');
}

export async function writeReport(dir, results, destination) {
  const messages = results.map(messageFor).filter(Boolean);
  await writeFile(`${dir}/mensagens.txt`, messages.join('\n\n--------------------\n\n'), 'utf8');
  await writeFile(`${dir}/resumo.json`, JSON.stringify({ consultadoEm: new Date().toISOString(), resultados: results }, null, 2));
  const cards = results.map(r => {
    const message = messageFor(r);
    const query = message ? `https://wa.me/${destination}?text=${encodeURIComponent(message)}` : '';
    return `<article><h2>${esc(r.linha)}</h2><p class="status">${esc(({aberta:'Fatura em aberto', paga:'Fatura paga — somente conferência', sem_abertas:'Sem faturas em aberto', erro:'Conferência necessária'})[r.status])}</p>
      <p>${esc(r.valor)} ${r.vencimento ? ` • Vencimento: ${esc(r.vencimento)}` : ''}</p>
      ${r.aviso ? `<p>${esc(r.aviso)}</p>` : ''}
      ${r.pdf ? `<p><a href="${esc(r.pdf)}">Abrir fatura PDF</a></p>` : ''}
      ${message ? `<pre>${esc(message)}</pre><a class="button" href="${esc(query)}" target="_blank" rel="noreferrer">Abrir mensagem no WhatsApp</a>` : ''}</article>`;
  }).join('');
  await writeFile(`${dir}/index.html`, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faturas TIM</title>
    <style>body{font:16px system-ui;background:#f1f5f9;color:#17243c;max-width:850px;margin:40px auto;padding:0 20px}h1{color:#003cc5}article{background:white;padding:24px;border-radius:16px;margin:20px 0;border:1px solid #dce3ed}h2{margin:0}.status{font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fc;padding:16px;font:inherit}.button{display:inline-block;background:#075e54;color:white;padding:12px 18px;border-radius:8px;text-decoration:none}a{color:#003cc5}small{color:#475569}</style>
    <h1>Suas faturas TIM</h1><p>Consulta em ${esc(new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}.</p>
    <p>Confira a fatura e o beneficiário no aplicativo do banco. O botão prepara a mensagem; você escolhe o contato e confirma o envio no WhatsApp.</p>${cards}<small>Os arquivos ficam nesta máquina. Uma consulta não confirma o pagamento nem envia mensagens automaticamente.</small></html>`, 'utf8');
}
