import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCodes, validBoleto, validPix } from '../src/codes.js';
import { messageFor } from '../src/report.js';

// Exemplo público de linha digitável bancária, sem dados de cliente.
const line = '00190500954014481606906809350314337370000000100';
test('aceita linha digitável e rejeita alteração de dígito', () => {
  assert.equal(validBoleto(line), true);
  assert.equal(validBoleto('2' + line.slice(1)), false);
  assert.equal(validBoleto('0'.repeat(48)), false);
});
test('extrai linha formatada, sem confundir telefone com código', () => {
  const formatted = '00190.50095 40144.816069 06809.350314 3 37370000000100';
  assert.deepEqual(extractCodes('Telefone 63999999999\n' + formatted).boletos,[line]);
});
test('não aprova Pix com CRC inválido', () => {
  assert.equal(validPix('000201br.gov.bcb.pix63040000'),false);
});
test('não prepara mensagem para conta paga, falha ou códigos ambíguos', () => {
  for (const status of ['paga','sem_abertas','erro']) assert.equal(messageFor({status,boletos:[line]}),'');
  assert.equal(messageFor({status:'aberta',boletos:[line,line],pix:[]}),'');
  assert.match(messageFor({linha:'63999999999',status:'aberta',boletos:[line],pix:[]}),/Código de barras/);
});
