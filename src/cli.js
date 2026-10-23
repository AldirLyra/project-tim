import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { login, consult, enableAccessibility } from './tim.js';
import { writeReport } from './report.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
if (args.has('--help')) {
  console.log('Uso: npm start [--historico] [--nao-abrir]\n--historico: baixa a fatura paga mais recente quando não há contas em aberto; não prepara envio de conta paga.');
  process.exit(0);
}

let muted = false;
async function secret(prompt) {
  if (!process.stdin.isTTY) throw new Error('Execute em um terminal interativo para informar a senha.');
  process.stdout.write(prompt);
  muted = true;
  try { return await rl.question(''); }
  finally { muted = false; process.stdout.write('\n'); }
}

let browser;
let rl;
let dir;
const results = [];
let config;
try {
  config = JSON.parse(await readFile(path.join(root,'config.json'),'utf8'));
  if (!/^\d{11}$/.test(config.usuario) || !Array.isArray(config.linhas) || !config.linhas.length || config.linhas.some(l=>!/^\d{11}$/.test(l))) {
    throw new Error('Confira usuario e linhas no config.json: use números de 11 dígitos com DDD.');
  }
  const destination = String(config.whatsappDestino || '').replace(/\D/g,'');
  if (destination && !/^55\d{10,11}$/.test(destination)) throw new Error('whatsappDestino deve conter 55 + DDD + número, ou ficar vazio.');
  console.log('\nTIM • consulta local de faturas\nA senha não será salva. Nenhuma mensagem será enviada automaticamente.\n');
  const output = new Writable({write(chunk,_encoding,callback){
    if (!muted) process.stdout.write(chunk);
    callback();
  }});
  rl = createInterface({input:process.stdin,output,terminal:true});
  let password = (await secret(`Senha Meu TIM (${config.usuario}): `)).trim();
  if (!/^\d{4}$/.test(password)) throw new Error('Informe a senha de quatro números do Meu TIM.');
  const ask = text => rl.question(text);
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  dir = path.join(root,'resultados',stamp);
  await mkdir(dir,{recursive:true});
  // Contexto descartável: não grava cookies, senha, perfil ou sessão no projeto.
  const launch = {headless:false};
  try { browser = await chromium.launch({...launch,channel:'chrome'}); }
  catch { 
    try { browser = await chromium.launch({...launch,channel:'msedge'}); }
    catch { throw new Error('Instale Microsoft Edge ou Google Chrome e tente novamente.'); }
  }
  const context = await browser.newContext({viewport:{width:1000,height:800},acceptDownloads:true,locale:'pt-BR'});
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  console.log('Abrindo o Meu TIM...');
  await login(page,config.usuario,password,ask,dir);
  password = '';
  for (const line of [...new Set(config.linhas)]) {
    console.log(`\nConsultando ${line}...`);
    try {
      const result = await consult(page,line,dir,args.has('--historico'),ask);
      results.push(result);
      console.log(result.status === 'sem_abertas' ? 'Sem faturas em aberto.' : result.aviso || 'Fatura consultada.');
    } catch (error) {
      // Evita registrar mensagens de exceção de navegador que possam conter tokens.
      console.log('Não foi possível concluir esta linha. Ela ficará pendente no relatório.');
      console.log(String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g,'[endereço do portal]'));
      const filename = `${line}-conferir.png`;
      await page.screenshot({path:path.join(dir,filename)}).catch(()=>{});
      await writeFile(path.join(dir,`${line}-diagnostico.txt`),String(error.message).replace(/https?:\/\/\S+/g,'[endereço do portal]'));
      await writeFile(path.join(dir,`${line}-tela.txt`),await page.locator('body').ariaSnapshot()).catch(()=>{});
      results.push({linha:line,status:'erro',aviso:'Não foi possível confirmar os dados desta linha. Confira a captura local e tente novamente.',captura:filename});
    }
    await writeReport(dir,results,destination);
    // Rota pública observada no portal; evita ficar preso em um detalhe ou seletor.
    await page.goto('https://meuplano2.tim.com.br/invoices',{waitUntil:'domcontentloaded'}).catch(()=>{});
    await enableAccessibility(page);
  }
  console.log(`\nRelatório: ${path.join(dir,'index.html')}`);
  console.log(`Mensagens: ${path.join(dir,'mensagens.txt')}`);
  if (!args.has('--nao-abrir')) {
    spawn('explorer.exe',[path.join(dir,'index.html')],{detached:true,stdio:'ignore',windowsHide:true}).unref();
  }
  if (results.some(r=>r.status === 'erro' || r.aviso)) {
    console.log('Há itens para conferir. Os demais resultados foram preservados.');
    process.exitCode = 2;
  }
} catch (error) {
  // Erros de nossa configuração não incluem credenciais; erros de navegador ficam genéricos.
  const reason = String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g,'[endereço do portal]');
  console.error(`Consulta interrompida: ${reason}`);
  if (dir) {
    const current = browser?.contexts()[0]?.pages()[0];
    await current?.screenshot({path:path.join(dir,'interrompido.png')}).catch(()=>{});
    await writeFile(path.join(dir,'interrompido.txt'),'Consulta interrompida. Nenhum envio automático foi realizado.\n');
    if (config) await writeReport(dir,results,String(config.whatsappDestino || '').replace(/\D/g,''));
  }
  process.exitCode = 1;
} finally {
  rl?.close();
  await browser?.close();
}
