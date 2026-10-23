import path from 'node:path';
import { readPdf } from './pdf.js';
import { extractCodes } from './codes.js';

// Controles verificados no Meu TIM em 23/10/2026. O site usa Flutter.
const names = {
  selector: 'Todos os produtos',
  invoices: 'Botão saiba sobre suas contas',
  history: 'Acessar o histórico de faturas pagas'
};

export async function uiText(page) {
  return page.locator('body').innerText();
}

export async function ready(page, predicate, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    await enableAccessibility(page);
    if (await predicate()) return;
    await page.waitForTimeout(350);
  }
  throw new Error('O portal não terminou de carregar ou mudou de interface.');
}

export async function enableAccessibility(page) {
  const enable = page.getByRole('button', { name: 'Enable accessibility', exact: true });
  if (await enable.count()) await enable.press('Enter', { timeout: 2000 }).catch(() => {});
  const dismiss = page.getByRole('button', { name: 'Dispensar', exact: true });
  for (let i = 0; i < 3 && await dismiss.count(); i++) {
    await dismiss.last().click({timeout:2000}).catch(() => {});
    await page.waitForTimeout(100);
  }
  // Ofertas de entrada só são fechadas quando há um botão com este nome.
  if (/banner-screen/.test(page.url())) {
    const close = page.getByRole('button',{name:/^fechar$/i});
    if (await close.count()) await close.last().click({timeout:1500,force:true}).catch(() => {});
    else await page.goto('https://meuplano2.tim.com.br/invoices',{waitUntil:'domcontentloaded'});
  }
}

async function click(page, name) {
  try {
    await page.getByRole('button', { name, exact: typeof name === 'string' }).last().click({ timeout: 5000, force:true });
  } catch (error) {
    // Uma oferta pode surgir depois que o botão da página já foi exposto.
    await enableAccessibility(page);
    await ready(page,async()=>await page.getByRole('button',{name,exact:typeof name === 'string'}).count()>0);
    await page.getByRole('button',{name,exact:typeof name === 'string'}).last().click({timeout:15000,force:true});
  }
}

export async function login(page, username, password, ask, dir) {
  await page.goto('https://meutim.tim.com.br/novo/login', { waitUntil:'domcontentloaded' });
  await page.getByRole('textbox', { name:'Digite seu número TIM', exact:true }).waitFor({ timeout:45000 });
  await enableAccessibility(page);
  const number = page.getByRole('textbox', {name:'Digite seu número TIM',exact:true});
  const pass = page.getByRole('textbox', {name:'Senha',exact:true});
  await number.fill(''); await number.pressSequentially(username,{delay:100});
  await pass.fill(''); await pass.pressSequentially(password,{delay:100});
  if ((await number.inputValue()).replace(/\D/g,'') !== username || await pass.inputValue() !== password) {
    throw new Error('O formulário não recebeu todos os caracteres. Tente novamente.');
  }
  // Clicar no rótulo funciona no checkbox personalizado da TIM.
  const keep = page.locator('#manter');
  await enableAccessibility(page);
  if (await keep.isChecked()) await page.getByText('Manter-me conectado',{exact:true}).filter({visible:true}).first().click();
  console.log('Autenticando no Meu TIM...');
  await click(page, 'Entrar agora');
  console.log('Aguardando o portal de contas...');
  try {
    await ready(page, async () => await page.getByRole('button',{name:names.selector,exact:true}).count() > 0);
  } catch {
    if (dir) await page.screenshot({path:path.join(dir,'login-atencao.png')}).catch(()=>{});
    console.log('O login precisa de atenção. Confira a janela do navegador (senha, SMS, captcha ou oferta).');
    await ask('Conclua o acesso e feche qualquer oferta. Depois pressione Enter aqui. ');
    await ready(page, async () => await page.getByRole('button',{name:names.selector,exact:true}).count() > 0);
  }
}

export async function selectLine(page, line) {
  await ready(page, async () => await page.getByRole('button',{name:names.selector,exact:true}).count() > 0);
  await click(page, names.selector);
  await ready(page, async () => await page.getByRole('button',{name:'Fechar seletor de planos',exact:true}).count() > 0);
  const target = page.getByRole('button',{name:new RegExp(`\\b${line}\\b`)}).first();
  // A lista é rolável; o número, e não a posição, identifica a linha.
  // Os nós Flutter podem estar presentes mesmo fora da área de exibição.
  for (let step = 0; step < 12; step++) {
    if (await target.count()) {
      try {
        await target.scrollIntoViewIfNeeded({timeout:1500});
        await target.click({timeout:2000,force:true});
        await ready(page, async () => await page.getByRole('button',{name:'Fechar seletor de planos',exact:true}).count() === 0);
        return;
      } catch (error) {
        if (step === 11) throw error;
      }
    }
    const size = page.viewportSize();
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(200);
  }
  throw new Error(`Linha ${line} não localizada. Nenhuma outra linha foi usada em seu lugar.`);
}

export async function goInvoices(page) {
  // A troca de chip reinicia a página inicial e seus atalhos podem demorar
  // a reaparecer. A rota de Contas é a mesma exposta na navegação do portal.
  await page.goto('https://meuplano2.tim.com.br/invoices',{waitUntil:'domcontentloaded'});
  await ready(page, async () => /todas pagas|Gerenciamento de conta|vencimento|em aberto/i.test(await uiText(page)));
}

export async function getPdf(page, dir, filename) {
  const event = page.waitForEvent('download', {timeout:30000});
  // Anexa o tratamento imediatamente, mesmo se o clique falhar.
  const guarded = event.catch(() => null);
  await click(page, 'Baixar PDF');
  const download = await guarded;
  if (!download) throw new Error('O portal não iniciou o download do PDF.');
  const file = path.join(dir, filename);
  await download.saveAs(file);
  if (await download.failure()) throw new Error('O download da fatura falhou.');
  return { text: await readPdf(file), pdf: filename };
}

function details(text) {
  return {
    valor: text.match(/R\$\s*[\d.]+,\d{2}/)?.[0] ?? '',
    vencimento: text.match(/Vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? ''
  };
}

async function collectDetail(page, line, dir, status, suffix = '') {
  let text = await uiText(page);
  let pdf;
  const downloadButton = page.getByRole('button',{name:'Baixar PDF',exact:true});
  if (await downloadButton.count()) {
    const result = await getPdf(page, dir, `${line}${suffix}.pdf`);
    if (!result.text.replace(/\D/g,'').includes(line)) {
      throw new Error('O PDF não confirma a linha consultada. Confira o documento manualmente.');
    }
    text += '\n' + result.text;
    pdf = result.pdf;
  }
  const codes = extractCodes(text);
  return { linha:line, status, ...details(text), ...codes, pdf,
    ...((codes.boletos.length !== 1 && codes.pix.length !== 1) ? {aviso:'Não foi encontrado um único código válido. Confira o PDF; nenhuma mensagem foi preparada.'} : {}) };
}

export async function consult(page, line, dir, history, ask) {
  await selectLine(page, line);
  await goInvoices(page);
  const text = await uiText(page);
  if (/contas estão todas pagas/i.test(text)) {
    if (!history) return {linha:line,status:'sem_abertas',boletos:[],pix:[]};
    await click(page, names.history);
    await ready(page, async () => await page.getByRole('button',{name:/^Veja os detalhes da fatura /}).count() > 0);
    await page.getByRole('button',{name:/^Veja os detalhes da fatura /}).first().click({force:true});
    await ready(page, async () => await page.getByRole('button',{name:'Baixar PDF',exact:true}).count() > 0);
    const result = await collectDetail(page,line,dir,'paga','-historico');
    await click(page, /^Fechar$/i);
    await click(page, /^Fechar$/i);
    return result;
  }
  // O fluxo de fatura em aberto pode variar por plano. Só abre detalhes
  // ou baixa PDF; não aciona botões de pagamento, quitação ou negociação.
  const detail = page.getByRole('button',{name:/^(Veja os detalhes da fatura|Ver detalhes da fatura|Detalhe da fatura)/i});
  if (await detail.count() === 1) {
    await detail.click({force:true});
    await ready(page, async () => /Detalhe da fatura/i.test(await uiText(page)));
  } else if (!await page.getByRole('button',{name:'Baixar PDF',exact:true}).count()) {
    console.log(`Linha ${line}: abra a fatura em aberto no navegador e deixe os detalhes visíveis.`);
    console.log('Se o portal não mostrar Baixar PDF, use Copiar código no site antes de continuar.');
    await ask('Pressione Enter quando estiver na fatura correta. ');
  }
  // Checagem final para nunca compartilhar automaticamente um documento pago.
  const screen = await uiText(page);
  if (/\bPago\b|fatura paga/i.test(screen) && !/não pag[ao]/i.test(screen)) {
    throw new Error('A tela indica fatura paga. O envio foi bloqueado para conferência.');
  }
  let result = await collectDetail(page,line,dir,'aberta');
  if (result.boletos.length !== 1 && result.pix.length !== 1) {
    const pasted = await ask('Código não extraído. Cole aqui a linha digitável/Pix (ou Enter para deixar pendente): ');
    if (pasted.trim()) result = {...result,...extractCodes(pasted)};
    if (result.boletos.length === 1 || result.pix.length === 1) delete result.aviso;
  }
  // Antes de trocar a linha, volta à página Contas; não depende de URL com token.
  if (await page.getByRole('button',{name:/^Fechar$/i}).count()) await click(page,/^Fechar$/i);
  return result;
}
