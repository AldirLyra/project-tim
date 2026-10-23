// Extrai somente codigos cujo digito verificador confere. Nenhuma IA altera os numeros.
export const digits = value => String(value).replace(/\D/g, '');

function mod10(s) {
  let sum = 0, weight = 2;
  for (const n of [...s].reverse()) {
    const v = Number(n) * weight;
    sum += Math.floor(v / 10) + v % 10;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - sum % 10) % 10;
}

function collectionMod11(s) {
  let sum = 0, weight = 2;
  for (const n of [...s].reverse()) {
    sum += Number(n) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const r = sum % 11;
  return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r;
}

export function validBoleto(input) {
  const s = digits(input);
  if (/^(\d)\1+$/.test(s)) return false;
  if (s.length === 48 && s[0] === '8' && /[6789]/.test(s[2])) {
    const check = /[67]/.test(s[2]) ? mod10 : collectionMod11;
    for (let i = 0; i < 48; i += 12) {
      if (check(s.slice(i, i + 11)) !== Number(s[i + 11])) return false;
    }
    const barcode = [0, 12, 24, 36].map(i => s.slice(i, i + 11)).join('');
    return check(barcode.slice(0, 3) + barcode.slice(4)) === Number(barcode[3]);
  }
  if (s.length === 47 && s[3] === '9') {
    for (const [start, end] of [[0,9], [10,20], [21,31]]) {
      if (mod10(s.slice(start,end)) !== Number(s[end])) return false;
    }
    const bar = s.slice(0,4) + s[32] + s.slice(33) + s.slice(4,9) + s.slice(10,20) + s.slice(21,31);
    let sum = 0, weight = 2;
    for (const n of [...(bar.slice(0,4) + bar.slice(5))].reverse()) {
      sum += Number(n) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    let dv = 11 - sum % 11;
    if (dv === 0 || dv === 10 || dv === 11) dv = 1;
    return dv === Number(bar[4]);
  }
  return false;
}

export function validPix(s) {
  if (!s.startsWith('000201') || !/6304[0-9A-Fa-f]{4}$/.test(s) || !s.toLowerCase().includes('br.gov.bcb.pix')) return false;
  let crc = 0xffff;
  for (const byte of Buffer.from(s.slice(0, -4), 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).padStart(4,'0').toUpperCase() === s.slice(-4).toUpperCase();
}

export function extractCodes(text) {
  const boletos = new Set(), pix = new Set();
  // Espacos e pontuacao podem separar blocos da linha digitavel no PDF.
  for (const match of text.matchAll(/(?<!\d)(?:\d[.\s-]*){46,48}(?!\d)/g)) {
    const code = digits(match[0]);
    if (validBoleto(code)) boletos.add(code);
  }
  for (const match of text.matchAll(/000201[\s\S]*?6304[0-9a-fA-F]{4}/g)) {
    if (validPix(match[0])) pix.add(match[0]);
    else {
      const unwrapped = match[0].replace(/[\r\n]+/g,'');
      if (validPix(unwrapped)) pix.add(unwrapped);
    }
  }
  return { boletos: [...boletos], pix: [...pix] };
}
