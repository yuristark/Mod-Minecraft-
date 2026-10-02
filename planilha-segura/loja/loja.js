(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const dia = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MP_URL = /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.[a-z]{2})?\//i;
const SITE = location.origin + location.pathname;

let sb = null, conf = null, vitrine = null, status = null, perfil = null;
let modo = 'entrar', recuperando = false, appAberto = false, retornoPagamento = null, espera = null, telaAnterior = 'app';

/* ---------- utilidades ---------- */
const TELAS = ['carregando', 'erro', 'porta', 'app', 'perfil', 'painel'];
function mostrar(t) {
  TELAS.forEach(x => { $('#t-' + x).hidden = x !== t; });
  if (t === 'perfil' || t === 'painel') window.scrollTo(0, 0);
  if (t !== 'painel') pararAuto();
}
function porta(p) { ['entrar', 'nova-senha', 'comprar'].forEach(x => { $('#p-' + x).hidden = x !== p; }); mostrar('porta'); }
function carregando(msg) { $('#carregandoMsg').textContent = msg || 'Carregando…'; mostrar('carregando'); }
function falhaGeral(msg) { $('#erroMsg').textContent = msg; mostrar('erro'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 5000); }
function msg(id, texto, tipo) { const el = $(id); el.textContent = texto || ''; el.className = 'msg' + (tipo ? ' ' + tipo : ''); }
function iniciais(nome, email) {
  const base = String(nome || '').trim() || String(email || '').split('@')[0];
  const p = base.split(/[\s._-]+/).filter(Boolean);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function haQuanto(d) {
  if (!d) return 'nunca';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
  if (s < 86400 * 30) return 'há ' + Math.floor(s / 86400) + (Math.floor(s / 86400) === 1 ? ' dia' : ' dias');
  return dia(d);
}
// "Chrome no Windows" a partir do user-agent
function aparelho(ua) {
  ua = String(ua || '');
  if (!ua) return { nome: 'Aparelho desconhecido', movel: false };
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
  return { nome: nav + (so ? ' no ' + so : ''), movel: /iPhone|Android|Mobile/.test(ua) };
}
const ICO_PC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
const ICO_CEL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>';

const TRADUCOES = [
  [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/Email not confirmed/i, 'Confirme seu e-mail primeiro. Procure a mensagem de confirmação na sua caixa de entrada (e no spam).'],
  [/User already registered/i, 'Já existe uma conta com este e-mail. Use “Entrar”.'],
  [/Password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas seguidas. Aguarde alguns minutos.'],
  [/New password should be different/i, 'A nova senha precisa ser diferente da anterior.'],
  [/weak|pwned|leaked/i, 'Senha fraca ou já vazada na internet. Escolha outra.'],
  [/already been registered|email address.*(taken|exists)/i, 'Este e-mail já é usado por outra conta.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Sem conexão. Verifique a internet e tente de novo.'],
  [/Could not find the function|does not exist|schema cache/i, 'O banco de dados não está atualizado. O dono precisa rodar o arquivo SQL do manual.'],
  [/permission denied/i, 'Sem permissão para fazer isso.']
];
function traduzir(e) {
  const m = String(e && e.message || e || '');
  for (const [re, t] of TRADUCOES) if (re.test(m)) return t;
  return e && e.amigavel && m.length < 300 ? m : 'Algo deu errado. Tente de novo.';
}
function amigavel(texto) { const e = new Error(texto); e.amigavel = true; return e; }
async function rpc(nome, args) {
  const { data: d, error } = await sb.rpc(nome, args || {});
  if (error) throw (error.code === 'P0001' || error.code === '42501') ? amigavel(error.message) : new Error(error.message);
  return d;
}
const silencioso = (nome, args) => { if (sb) sb.rpc(nome, args || {}).then(() => {}, () => {}); };
function baixar(nome, conteudo, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* ---------- tema (o mesmo do aplicativo) ---------- */
function lerTema() { try { return JSON.parse(localStorage.getItem('ps.tema')); } catch (e) { return null; } }
function aplicarTema(t) { if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* ---------- configuração ---------- */
function chaveSecreta(k) {
  if (/^sb_secret_/.test(k)) return true;
  const p = k.split('.');
  if (p.length !== 3) return false;
  try { return JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (e) { return false; }
}
async function lerConfig() {
  let c;
  try {
    const r = await fetch('config.json', { cache: 'no-store', credentials: 'omit' });
    if (!r.ok) throw new Error();
    c = await r.json();
  } catch (e) { throw new Error('O arquivo config.json não foi encontrado. Ele precisa estar na mesma pasta deste site.'); }
  const url = String(c && c.supabaseUrl || '').replace(/\/+$/, '');
  const chave = String(c && c.supabaseChavePublica || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !chave || /COLE|SUA_/.test(chave)) {
    throw new Error('Este site ainda não foi configurado. O dono precisa preencher o arquivo config.json (veja o MANUAL-DO-DONO).');
  }
  if (chaveSecreta(chave)) {
    throw new Error('O config.json está com a chave SECRETA do Supabase. Troque imediatamente pela chave pública (anon / publishable) e gere uma nova chave secreta no Supabase.');
  }
  return { url, chave };
}

/* ---------- fluxo principal ---------- */
async function iniciar() {
  aplicarTema(lerTema());
  carregando();
  retornoPagamento = new URLSearchParams(location.search).get('pagamento');
  try { conf = await lerConfig(); } catch (e) { falhaGeral(e.message); return; }
  sb = supabase.createClient(conf.url, conf.chave, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recuperando = true; porta('nova-senha'); } });
  try { vitrine = await rpc('config_publica'); }
  catch (e) { falhaGeral('Não foi possível falar com o servidor. ' + traduzir(e)); return; }
  preencherVitrine();
  if (location.search) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  await rotear();
  iniciarPresenca();
}

function preencherVitrine() {
  $$('.nomeProduto').forEach(el => { el.textContent = vitrine.nome_produto; });
  document.title = vitrine.nome_produto;
  if (vitrine.descricao) { $('#descricaoProduto').textContent = vitrine.descricao; $('#pitchDescricao').textContent = vitrine.descricao; }
  $('#precoProduto').textContent = vitrine.preco_centavos ? brl(vitrine.preco_centavos) : '—';
  $('#semDono').hidden = !!vitrine.tem_dono;
  $('#termosContato').textContent = vitrine.email_suporte ? 'Pelo e-mail ' + vitrine.email_suporte + '.' : 'Pelo e-mail de suporte informado pelo vendedor.';
  $('#privContato').textContent = vitrine.email_suporte ? 'Dúvidas ou pedidos sobre seus dados: ' + vitrine.email_suporte + '.' : '';
}

async function rotear() {
  if (recuperando) { porta('nova-senha'); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { appAberto = false; $('#convite').hidden = true; porta('entrar'); return; }
  try { status = await rpc('meu_status'); }
  catch (e) { falhaGeral('Não foi possível conferir seu acesso. ' + traduzir(e)); return; }
  $('#convite').hidden = !status.convite_propriedade;
  $('#btnPainelPerfil').hidden = !status.eh_dono;
  if (status.tem_acesso) { pararEspera(); await abrirApp(); }
  else mostrarCompra();
}

/* ---------- presença ("online agora") ---------- */
let presencaT = null;
function iniciarPresenca() {
  const pulso = async () => {
    if (document.visibilityState !== 'visible') return;
    const { data: { session } } = await sb.auth.getSession();
    if (session) silencioso('registrar_presenca');
  };
  pulso();
  clearInterval(presencaT);
  presencaT = setInterval(pulso, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pulso(); });
}

/* ---------- entrar ---------- */
function definirModo(m) {
  modo = m;
  $$('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
  const criar = m === 'criar';
  $('#campoNome').hidden = !criar; $('#campoSenha2').hidden = !criar; $('#campoForca').hidden = !criar;
  $('#btnEntrar').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#btnEsqueci').hidden = criar;
  $('#tituloEntrar').textContent = criar ? 'Criar sua conta' : 'Entrar na sua conta';
  $('#subEntrar').textContent = criar ? 'Leva menos de um minuto.' : 'Bem-vindo de volta.';
  $('#senha').autocomplete = criar ? 'new-password' : 'current-password';
  msg('#msgEntrar', '');
}
function forcaSenha(s) {
  let p = 0;
  if (s.length >= 8) p++;
  if (s.length >= 12) p++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++;
  if (/\d/.test(s)) p++;
  if (/[^\w\s]/.test(s)) p++;
  return Math.min(4, p);
}
async function enviarEntrar(e) {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase(), senha = $('#senha').value, nome = $('#nome').value.trim();
  if (modo === 'criar' && nome.length < 2) return msg('#msgEntrar', 'Digite seu nome.', 'erro');
  if (!EMAIL.test(email)) return msg('#msgEntrar', 'Digite um e-mail válido.', 'erro');
  if (senha.length < 8) return msg('#msgEntrar', 'A senha precisa ter pelo menos 8 caracteres.', 'erro');
  const btn = $('#btnEntrar'); btn.disabled = true;
  try {
    if (modo === 'criar') {
      if (senha !== $('#senha2').value) { msg('#msgEntrar', 'As senhas não são iguais.', 'erro'); return; }
      if (forcaSenha(senha) < 2) { msg('#msgEntrar', 'Senha muito fraca. Misture letras, números e símbolos.', 'erro'); return; }
      const { data: d, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: SITE, data: { nome: nome.slice(0, 120) } } });
      if (error) throw error;
      if (!d.session) { msg('#msgEntrar', 'Conta criada. Enviamos um link de confirmação para ' + email + '. Abra o e-mail e clique no link para continuar.', 'ok'); return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
    $('#senha').value = ''; $('#senha2').value = '';
    silencioso('registrar_acesso', { p_tipo: 'login' });
    carregando('Entrando…');
    await rotear();
  } catch (err) { msg('#msgEntrar', traduzir(err), 'erro'); }
  finally { btn.disabled = false; }
}
async function esqueci() {
  const email = $('#email').value.trim().toLowerCase();
  if (!EMAIL.test(email)) return msg('#msgEntrar', 'Digite seu e-mail no campo acima e clique de novo em “Esqueci minha senha”.', 'erro');
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
    if (error) throw error;
    msg('#msgEntrar', 'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha.', 'ok');
  } catch (err) { msg('#msgEntrar', traduzir(err), 'erro'); }
}
async function salvarNovaSenha(e) {
  e.preventDefault();
  const senha = $('#novaSenha').value;
  if (senha.length < 8) return msg('#msgNovaSenha', 'A senha precisa ter pelo menos 8 caracteres.', 'erro');
  try {
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) throw error;
    $('#novaSenha').value = ''; recuperando = false;
    silencioso('registrar_acesso', { p_tipo: 'senha' });
    toast('Senha alterada.');
    carregando(); await rotear();
  } catch (err) { msg('#msgNovaSenha', traduzir(err), 'erro'); }
}
async function sair() {
  try { await rpc('registrar_acesso', { p_tipo: 'saida' }); } catch (e) {}
  try { await sb.auth.signOut(); } catch (e) {}
  location.replace(location.pathname); // descarta o aplicativo da memória
}

/* ---------- compra ---------- */
const aceitaMp = () => vitrine.aceita_mp !== false;
const aceitaPix = () => !!(vitrine.aceita_pix && vitrine.pix && vitrine.pix.chave);
let forma = 'mp', pixAtual = null;
function escolherForma(f) {
  forma = f;
  $('#formaMp').setAttribute('aria-checked', String(f === 'mp'));
  $('#formaPix').setAttribute('aria-checked', String(f === 'pix'));
  $('#pagMp').hidden = f !== 'mp';
  $('#pagPix').hidden = f !== 'pix';
}
function mostrarCompra() {
  const abertas = !!vitrine.vendas_abertas && (aceitaMp() || aceitaPix());
  $('#blocoVenda').hidden = !abertas;
  $('#formas').hidden = !abertas || !(aceitaMp() && aceitaPix());
  $('#formaMp').hidden = !aceitaMp(); $('#formaPix').hidden = !aceitaPix();
  $('#bancos').hidden = !abertas;
  $('#bancosCartao').hidden = !aceitaMp();
  $('#linkJaPaguei').hidden = !aceitaMp();
  $('#btnComprar').textContent = 'Pagar ' + (abertas ? brl(vitrine.preco_centavos) : '') + ' com Pix, cartão ou boleto';
  $('#btnGerarPix').textContent = 'Gerar Pix de ' + (abertas ? brl(vitrine.preco_centavos) : '');
  if (abertas) escolherForma(aceitaMp() ? (forma === 'pix' && aceitaPix() ? 'pix' : 'mp') : 'pix');
  else { $('#pagMp').hidden = true; $('#pagPix').hidden = true; }
  $('#vendasFechadas').hidden = abertas;
  $('#vendasFechadas').textContent = 'As vendas estão fechadas no momento.' + (vitrine.email_suporte ? ' Fale com ' + vitrine.email_suporte + '.' : '');
  $('#quemCompra').textContent = 'Conectado como ' + (status && status.email || '');
  const av = $('#avisoCompra');
  if (retornoPagamento === 'aprovado' || retornoPagamento === 'pendente') {
    av.className = 'aviso ok'; av.hidden = false;
    av.textContent = retornoPagamento === 'aprovado'
      ? 'Pagamento recebido. Liberando seu acesso… esta página abre o aplicativo sozinha em instantes.'
      : 'Aguardando a confirmação do pagamento. Pix costuma levar poucos segundos; boleto, até 3 dias úteis. Esta página abre o aplicativo sozinha quando confirmar.';
    esperarLiberacao();
  } else if (retornoPagamento === 'falhou') {
    av.className = 'aviso'; av.hidden = false;
    av.textContent = 'O pagamento não foi concluído. Nada foi cobrado. Você pode tentar de novo.';
  } else av.hidden = true;
  porta('comprar');
  if (aceitaPix() && !pixAtual) retomarPix();
}
// Se a pessoa já tinha gerado um Pix (e talvez avisado que pagou), mostra de novo ao voltar.
async function retomarPix() {
  try {
    const p = await rpc('meu_perfil');
    const c = (p.compras || []).find(x => x.metodo === 'pix_manual' && x.status === 'pendente');
    if (c) { escolherForma('pix'); await gerarPix(); }
  } catch (e) {}
}
async function gerarPix() {
  const btn = $('#btnGerarPix'); btn.disabled = true;
  try {
    const r = await rpc('solicitar_pix');
    pixAtual = r;
    const pix = vitrine.pix;
    const codigo = PixBRCode().payload({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valorCentavos: r.valor_centavos, txid: 'PS' + r.codigo });
    const qr = qrcode(0, 'M'); qr.addData(codigo); qr.make();
    $('#pixQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    $('#pixCodigo').value = codigo;
    $('#pixInfo').innerHTML = [['Valor', esc(brl(r.valor_centavos))], ['Recebedor', esc(pix.nome)], ['Código da compra', `<b class="num">${esc(r.codigo)}</b>`]].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#pixBox').hidden = false; btn.hidden = true;
    if (r.informado) avisoPixInformado();
  } catch (e) { const av = $('#avisoCompra'); av.className = 'aviso'; av.hidden = false; av.textContent = traduzir(e); }
  finally { btn.disabled = false; }
}
function avisoPixInformado() {
  const av = $('#avisoCompra');
  av.className = 'aviso ok'; av.hidden = false;
  av.textContent = 'Recebemos seu aviso de pagamento. Assim que o Pix for conferido, seu acesso é liberado e esta página abre o aplicativo sozinha. Pode fechar e voltar depois: é só entrar de novo.' + (vitrine.email_suporte ? ' Dúvidas: ' + vitrine.email_suporte + '.' : '');
  $('#btnInformarPix').textContent = 'Aviso enviado. Aguardando conferência';
  $('#btnInformarPix').disabled = true;
  esperarLiberacao();
}
async function informarPix() {
  if (!pixAtual) return;
  try { await rpc('informar_pix', { p_compra: pixAtual.compra_id }); avisoPixInformado(); }
  catch (e) { toast(traduzir(e)); }
}
async function copiarPix() {
  const t = $('#pixCodigo');
  try { await navigator.clipboard.writeText(t.value); toast('Código Pix copiado. Cole no aplicativo do seu banco.'); }
  catch (e) { t.select(); toast('Selecione o código e copie com Ctrl+C.'); }
}
// Pede ao servidor para conferir no Mercado Pago os pagamentos deste usuário (caso o aviso automático atrase ou falhe).
async function verificarPagamento() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const r = await fetch(conf.url + '/functions/v1/criar-pagamento', {
    method: 'POST', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + session.access_token, apikey: conf.chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'verificar' })
  });
  return r.ok ? r.json().catch(() => null) : null;
}
let ultimaVerificacao = 0;
async function jaPaguei(el) {
  if (Date.now() - ultimaVerificacao < 15000) { toast('Aguarde alguns segundos antes de conferir de novo.'); return; }
  ultimaVerificacao = Date.now();
  if (el) el.disabled = true;
  const av = $('#avisoCompra');
  av.className = 'aviso ok'; av.hidden = false; av.textContent = 'Conferindo seu pagamento no Mercado Pago…';
  try {
    await verificarPagamento();
    const s = await rpc('meu_status');
    if (s.tem_acesso) { status = s; toast('Pagamento confirmado. Acesso liberado!'); await rotear(); return; }
    av.className = 'aviso';
    av.textContent = 'Ainda não encontramos um pagamento aprovado na sua conta. Pix e cartão costumam confirmar em poucos minutos; boleto, em até 3 dias úteis.' + (vitrine.email_suporte ? ' Se já foi descontado, fale com ' + vitrine.email_suporte + ' e informe o número do pagamento que está no comprovante do Mercado Pago.' : '');
  } catch (e) { av.className = 'aviso'; av.textContent = traduzir(e); }
  finally { if (el) el.disabled = false; }
}
function esperarLiberacao() {
  if (espera) return;
  let tentativas = 0;
  if (aceitaMp()) verificarPagamento().catch(() => {});
  const passo = async () => {
    tentativas++;
    if (tentativas % 8 === 0 && aceitaMp()) await verificarPagamento().catch(() => {});
    try {
      const s = await rpc('meu_status');
      if (s.tem_acesso) { status = s; retornoPagamento = null; pararEspera(); toast('Acesso liberado. Bom trabalho!'); await rotear(); return; }
    } catch (e) {}
    espera = setTimeout(passo, tentativas < 45 ? 4000 : 20000);
  };
  espera = setTimeout(passo, 2500);
}
function pararEspera() { clearTimeout(espera); espera = null; }
async function comprar() {
  const btn = $('#btnComprar'); btn.disabled = true;
  const av = $('#avisoCompra');
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { await rotear(); return; }
    const r = await fetch(conf.url + '/functions/v1/criar-pagamento', {
      method: 'POST', credentials: 'omit',
      headers: { Authorization: 'Bearer ' + session.access_token, apikey: conf.chave, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw amigavel(d.erro || 'Não foi possível iniciar o pagamento.');
    if (!MP_URL.test(String(d.url || ''))) throw amigavel('Endereço de pagamento inesperado. Avise o suporte.');
    btn.textContent = 'Abrindo o Mercado Pago…';
    location.assign(d.url);
  } catch (e) {
    av.className = 'aviso'; av.hidden = false; av.textContent = traduzir(e);
    btn.disabled = false;
  }
}

/* ---------- aplicativo ---------- */
async function abrirApp() {
  if (appAberto) { mostrar('app'); return; }
  carregando('Abrindo o aplicativo…');
  const { data: arq, error } = await sb.storage.from('app').download('planilha-segura.html');
  if (error || !arq) {
    falhaGeral(status && status.eh_dono
      ? 'O arquivo do aplicativo ainda não foi enviado. No Supabase, abra Storage > app e envie o arquivo planilha-segura.html (veja o manual).'
      : 'Não foi possível abrir o aplicativo agora. Tente de novo em instantes.');
    return;
  }
  const html = await arq.text();
  if (!/PlanilhaEngine/.test(html)) { falhaGeral('O arquivo do aplicativo no servidor está danificado. Avise o suporte.'); return; }
  $('#appFrame').srcdoc = html;
  appAberto = true;
  silencioso('registrar_acesso', { p_tipo: 'app' });
  mostrar('app');
}
async function enviarSessao() {
  const f = $('#appFrame').contentWindow;
  if (!f || !status) return;
  let nome = '';
  try { const p = perfil || await rpc('meu_perfil'); perfil = p; nome = p.nome || ''; } catch (e) {}
  f.postMessage({ tipo: 'ps-sessao', nome, email: status.email || '', dono: !!status.eh_dono }, location.origin);
}
window.addEventListener('message', e => {
  const f = $('#appFrame').contentWindow;
  if (!f || e.source !== f) return; // só aceita mensagens do próprio aplicativo
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.tipo === 'ps-pronto') enviarSessao();
  else if (d.tipo === 'ps-tema' && (d.tema === 'light' || d.tema === 'dark')) aplicarTema(d.tema);
  else if (d.tipo === 'ps-conta') {
    if (d.acao === 'perfil') abrirPerfil();
    else if (d.acao === 'painel' && status && status.eh_dono) abrirPainel();
    else if (d.acao === 'sair') sair();
  }
});
function voltar() {
  if (appAberto && status && status.tem_acesso) mostrar('app');
  else rotear();
}

/* ---------- meu perfil ---------- */
const TIPO_ACESSO = { login: 'Entrou', app: 'Abriu o aplicativo', perfil: 'Alterou o perfil', senha: 'Alterou a senha', saida: 'Saiu' };
const FORMA = { mercadopago: 'Mercado Pago', pix_manual: 'Pix direto' };
const SITUACAO = { aprovada: 'Aprovada', pendente: 'Aguardando', recusada: 'Recusada', cancelada: 'Cancelada', reembolsada: 'Reembolsada', contestada: 'Contestada', divergente: 'Valor diferente (devolvido)', duplicada: 'Em dobro (devolvida)' };
async function idSessaoAtual() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  try { return JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id || null; } catch (e) { return null; }
}
function htmlSessoes(lista, atual) {
  return lista.length ? lista.map(s => {
    const a = aparelho(s.navegador);
    const este = atual && s.id === atual;
    return `<li><span class="ic">${a.movel ? ICO_CEL : ICO_PC}</span><div class="t"><b>${esc(a.nome)} ${este ? '<span class="tag ok">Este aparelho</span>' : ''}</b><small>IP ${esc(s.ip || 'desconhecido')} · último uso ${esc(haQuanto(s.ultimo_uso))} · conectado em ${esc(data(s.criada_em))}</small></div></li>`;
  }).join('') : '<li class="muted">Nenhum aparelho conectado no momento.</li>';
}
function htmlAcessos(lista) {
  return lista.length ? lista.map(a => `<tr><td class="num">${esc(data(a.quando))}</td><td>${esc(TIPO_ACESSO[a.tipo] || a.tipo)}</td><td class="num">${esc(a.ip || '—')}</td><td>${esc(aparelho(a.navegador).nome)}</td></tr>`).join('')
    : '<tr class="vazio"><td colspan="4">Nenhum acesso registrado ainda.</td></tr>';
}
function htmlCompras(lista) {
  return lista.length ? lista.map(c => `<tr><td class="num">${esc(data(c.criado_em))}</td><td class="n num">${esc(brl(c.valor_centavos))}</td><td><span class="tag ${esc(c.status)}">${esc(SITUACAO[c.status] || c.status)}</span></td><td class="num">${esc(c.metodo === 'pix_manual' ? 'Pix ' + (c.codigo || '') : (c.mp_payment_id || '—'))}</td></tr>`).join('')
    : '<tr class="vazio"><td colspan="4">Nenhuma compra.</td></tr>';
}
function tagAcesso(p) {
  const a = p.acesso || {};
  if (a.origem === 'dono') return '<span class="tag info">Dono da loja</span>';
  if (a.ativo) return `<span class="tag ok">Acesso vitalício${a.origem === 'manual' ? ' (liberado pelo dono)' : ''}</span>`;
  return '<span class="tag bad">Sem acesso</span>';
}
async function abrirPerfil() {
  telaAnterior = 'perfil';
  carregando('Carregando seu perfil…');
  try { perfil = await rpc('meu_perfil'); }
  catch (e) { toast(traduzir(e)); voltar(); return; }
  const p = perfil, atual = await idSessaoAtual();
  $('#perfilCab').innerHTML = `<span class="avatar g">${esc(iniciais(p.nome, p.email))}</span>
    <div class="who"><b>${esc(p.nome || 'Sem nome')}</b><span class="muted">${esc(p.email)}</span>
    <div class="tags">${tagAcesso(p)}${p.email_confirmado ? '<span class="tag">E-mail confirmado</span>' : '<span class="tag warn">E-mail não confirmado</span>'}<span class="tag"><span class="dot on"></span>Online</span></div></div>
    <div class="muted" style="font-size:12.5px;text-align:right">Cliente desde ${esc(dia(p.conta_criada_em))}</div>`;
  $('#pfNome').value = p.nome || ''; $('#pfEmpresa').value = p.empresa || ''; $('#pfCargo').value = p.cargo || '';
  $('#pfTelefone').value = p.telefone || ''; $('#pfDocumento').value = p.documento || ''; $('#pfCidade').value = p.cidade || '';
  $('#pfEmail').value = '';
  const sessoes = p.sessoes || [];
  $('#perfilConta').innerHTML = [
    ['E-mail', esc(p.email)],
    ['Acesso', tagAcesso(p)],
    ['Desde', p.acesso && p.acesso.desde ? esc(data(p.acesso.desde)) : '—'],
    ['Conta criada em', esc(data(p.conta_criada_em))],
    ['Último login', esc(data(p.ultimo_login))],
    ['Aparelhos logados', esc(sessoes.length)],
    ['Identificador', `<span class="num" style="font-size:12px">${esc(p.id)}</span>`]
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#perfilSessoes').innerHTML = htmlSessoes(sessoes, atual);
  $('#perfilAcessos').innerHTML = htmlAcessos(p.acessos || []);
  $('#perfilCompras').innerHTML = htmlCompras(p.compras || []);
  $('#btnPainelPerfil').hidden = !p.eh_dono;
  ['#msgPerfil', '#msgSenha', '#msgEmail', '#msgExcluir'].forEach(id => msg(id, ''));
  mostrar('perfil');
}
function cpfOk(d) {
  if (/^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if ((s * 10) % 11 % 10 !== +d[t]) return false; }
  return true;
}
function cnpjOk(d) {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const w = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let t = 12; t < 14; t++) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * w[i + 13 - t]; let r = s % 11; r = r < 2 ? 0 : 11 - r; if (r !== +d[t]) return false; }
  return true;
}
async function salvarPerfil(e) {
  e.preventDefault();
  const nome = $('#pfNome').value.trim(), tel = $('#pfTelefone').value.trim(), doc = $('#pfDocumento').value.trim();
  if (nome.length < 2) return msg('#msgPerfil', 'Informe seu nome.', 'erro');
  const dTel = tel.replace(/\D/g, ''), dDoc = doc.replace(/\D/g, '');
  if (dTel && (dTel.length < 10 || dTel.length > 13)) return msg('#msgPerfil', 'Telefone inválido. Use DDD + número.', 'erro');
  if (dDoc && !(dDoc.length === 11 ? cpfOk(dDoc) : dDoc.length === 14 ? cnpjOk(dDoc) : false)) return msg('#msgPerfil', 'CPF ou CNPJ inválido. Confira os números.', 'erro');
  try {
    await rpc('salvar_meu_perfil', { p_nome: nome, p_empresa: $('#pfEmpresa').value, p_cargo: $('#pfCargo').value, p_telefone: tel, p_documento: doc, p_cidade: $('#pfCidade').value });
    perfil = null;
    msg('#msgPerfil', 'Dados salvos.', 'ok');
    enviarSessao();
  } catch (err) { msg('#msgPerfil', traduzir(err), 'erro'); }
}
async function trocarSenha(e) {
  e.preventDefault();
  const s1 = $('#pfSenha').value, s2 = $('#pfSenha2').value;
  if (s1.length < 8) return msg('#msgSenha', 'A senha precisa ter pelo menos 8 caracteres.', 'erro');
  if (s1 !== s2) return msg('#msgSenha', 'As senhas não são iguais.', 'erro');
  if (forcaSenha(s1) < 2) return msg('#msgSenha', 'Senha muito fraca. Misture letras, números e símbolos.', 'erro');
  try {
    const { error } = await sb.auth.updateUser({ password: s1 });
    if (error) throw error;
    $('#pfSenha').value = ''; $('#pfSenha2').value = '';
    silencioso('registrar_acesso', { p_tipo: 'senha' });
    msg('#msgSenha', 'Senha alterada.', 'ok');
  } catch (err) { msg('#msgSenha', traduzir(err), 'erro'); }
}
async function trocarEmail(e) {
  e.preventDefault();
  const email = $('#pfEmail').value.trim().toLowerCase();
  if (!EMAIL.test(email)) return msg('#msgEmail', 'Digite um e-mail válido.', 'erro');
  try {
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: SITE });
    if (error) throw error;
    msg('#msgEmail', 'Enviamos um link de confirmação para ' + email + '. A troca só vale depois de confirmar.', 'ok');
  } catch (err) { msg('#msgEmail', traduzir(err), 'erro'); }
}
async function sairOutros() {
  try {
    const { error } = await sb.auth.signOut({ scope: 'others' });
    if (error) throw error;
    toast('Os outros aparelhos foram desconectados.');
    abrirPerfil();
  } catch (err) { toast(traduzir(err)); }
}
async function baixarMeusDados() {
  try {
    const p = await rpc('meu_perfil');
    baixar('meus-dados.json', JSON.stringify(p, null, 2), 'application/json');
  } catch (err) { toast(traduzir(err)); }
}
async function excluirConta(e) {
  e.preventDefault();
  const confirmacao = $('#confirmaExcluir').value.trim();
  if (confirmacao !== 'EXCLUIR') return msg('#msgExcluir', 'Digite EXCLUIR, em letras maiúsculas, para confirmar.', 'erro');
  try {
    await rpc('excluir_minha_conta', { p_confirmacao: confirmacao });
    try { await sb.auth.signOut({ scope: 'local' }); } catch (err) {}
    alert('Sua conta foi excluída.');
    location.replace(location.pathname);
  } catch (err) { msg('#msgExcluir', traduzir(err), 'erro'); }
}

/* ---------- painel do dono ---------- */
const EVENTO = {
  compra_aprovada: ['Venda aprovada', 'aprovada'], compra_recusada: ['Pagamento recusado', ''], compra_cancelada: ['Pagamento cancelado', ''],
  compra_reembolsada: ['Reembolso: acesso retirado', 'reembolsada'], compra_contestada: ['Contestação no cartão: acesso retirado', 'contestada'],
  compra_divergente: ['Valor pago diferente do preço: devolução automática solicitada', 'divergente'], compra_pendente: ['Pagamento aguardando', ''],
  pix_informado: ['Comprador avisou que fez o Pix: confira no extrato e confirme em Vendas', 'warn'], pagamentos_alterados: ['Formas de pagamento alteradas', ''],
  pagamento_duplicado: ['Cobrança em dobro: devolução automática solicitada (confira no Mercado Pago)', 'divergente'],
  acesso_liberado: ['Acesso liberado manualmente', 'aprovada'], acesso_bloqueado: ['Acesso bloqueado manualmente', 'cancelada'],
  config_alterada: ['Configuração da loja alterada', ''], transferencia_iniciada: ['Transferência de dono iniciada', ''],
  transferencia_cancelada: ['Transferência cancelada', ''], propriedade_transferida: ['Novo dono assumiu a loja', 'aprovada'],
  dono_indicado_pelo_sql: ['Dono indicado pelo SQL Editor', ''], sessoes_encerradas: ['Aparelhos desconectados pelo dono', 'warn'],
  conta_excluida: ['Conta excluída pelo usuário', 'bad']
};
let vendas = [], usuarios = [], secao = 'geral', filtro = 'todos', autoT = null;
function abrirPainel() {
  telaAnterior = 'painel';
  mostrar('painel');
  mudarSecao(secao);
  carregarPainel();
  pararAuto();
  autoT = setInterval(() => { if (document.visibilityState === 'visible' && (secao === 'geral' || secao === 'usuarios')) carregarPainel(true); }, 30000);
}
function pararAuto() { clearInterval(autoT); autoT = null; }
function mudarSecao(s) {
  secao = s;
  $$('.pnav [data-psec]').forEach(b => { if (b.dataset.psec === s) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $$('[data-sec]').forEach(el => { el.hidden = el.dataset.sec !== s; });
}
function metrica(rot, val, sub, cls) { return `<div class="metrica${cls ? ' ' + cls : ''}"><span>${rot}</span><b class="num">${val}</b><small>${sub}</small></div>`; }
function grafico(dias) {
  const W = 720, H = 170, pad = 22, n = dias.length || 1, max = Math.max(1, ...dias.map(d => d.centavos));
  const bw = (W - pad * 2) / n;
  const barras = dias.map((d, i) => {
    const h = Math.round((H - 40) * d.centavos / max), x = pad + i * bw + 2, y = H - 22 - h;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(2, bw - 4).toFixed(1)}" height="${Math.max(h, d.centavos ? 2 : 0)}" rx="3" fill="var(--primary)"><title>${esc(dia(d.dia + 'T12:00:00'))}: ${esc(d.vendas)} venda(s), ${esc(brl(d.centavos))}</title></rect>`;
  }).join('');
  const rot = [0, Math.floor(n / 2), n - 1].map(i => dias[i] ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H - 4}" font-size="11" text-anchor="middle" fill="var(--muted)">${esc(new Date(dias[i].dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Receita por dia nos últimos 30 dias"><line x1="${pad}" x2="${W - pad}" y1="${H - 22}" y2="${H - 22}" stroke="var(--line)"/>${barras}${rot}</svg>`;
}
async function carregarPainel(silencio) {
  try {
    const [res, comp, us, evs] = await Promise.all([rpc('admin_resumo'), rpc('admin_listar_compras', { p_limite: 500 }), rpc('admin_listar_usuarios', { p_busca: null, p_limite: 2000 }), rpc('admin_listar_eventos', { p_limite: 200 })]);
    vendas = comp || []; usuarios = us || [];
    const c = res.config;
    $('#painelDono').textContent = 'Dono atual: ' + (c.dono_email || '');
    $('#painelAtualizado').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const total30 = (res.vendas_30d || []).reduce((s, d) => s + d.centavos, 0);
    $('#metricas').innerHTML =
      metrica('Usuários cadastrados', Number(res.usuarios).toLocaleString('pt-BR'), `${res.novos_7d} novo(s) nos últimos 7 dias`)
      + metrica('<span class="dot on"></span>Online agora', res.online_agora, 'Com o site aberto neste momento')
      + metrica('Contas logadas', res.logados == null ? '—' : res.logados, 'Com pelo menos um aparelho conectado')
      + metrica('Vendas aprovadas', Number(res.vendas_aprovadas).toLocaleString('pt-BR'), `${res.acessos_ativos} acesso(s) ativo(s)`)
      + metrica('Receita bruta', brl(res.receita_centavos), `${brl(total30)} nos últimos 30 dias`)
      + metrica('Para conferir', res.pendencias, res.pendencias ? 'Veja o histórico' : 'Nenhuma pendência', res.pendencias ? 'alerta' : '');
    const al = $('#alertaPix');
    al.hidden = !res.pix_aguardando;
    al.innerHTML = res.pix_aguardando ? `<b>${esc(res.pix_aguardando)} Pix aguardando sua confirmação.</b> Confira no extrato do banco e confirme em <button class="link" data-psec="vendas">Vendas</button>.` : '';
    $('#grafico').innerHTML = total30 ? grafico(res.vendas_30d || []) : '<p class="muted" style="padding:30px 0;text-align:center">Nenhuma venda nos últimos 30 dias.</p>';
    const on = usuarios.filter(u => u.online);
    $('#onlineList').innerHTML = on.length ? on.map(u => `<span><span class="avatar">${esc(iniciais(u.nome, u.email))}</span>${esc(u.nome || u.email)}</span>`).join('') : '<p class="muted">Ninguém online agora.</p>';
    $('#cUsuarios').textContent = usuarios.length;
    $('#cPend').hidden = !res.pendencias; $('#cPend').textContent = res.pendencias;
    renderUsuarios();
    $('#tabVendas').innerHTML = vendas.length ? vendas.map(v => {
      const pixPend = v.metodo === 'pix_manual' && v.status === 'pendente';
      const sit = pixPend ? (v.pix_informado_em ? '<span class="tag warn">Pix informado: conferir</span>' : '<span class="tag">Pix gerado, não pago</span>') : `<span class="tag ${esc(v.status)}">${esc(SITUACAO[v.status] || v.status)}</span>`;
      const acoes = pixPend ? `<button class="btn small primary" data-act="confirmar-pix" data-id="${esc(v.id)}" data-codigo="${esc(v.codigo)}" data-valor="${esc(brl(v.valor_centavos))}">Confirmar</button> <button class="btn small danger" data-act="recusar-pix" data-id="${esc(v.id)}">Recusar</button>` : '';
      return `<tr><td class="num">${esc(data(v.criado_em))}</td><td>${esc(v.email)}</td><td class="n num">${esc(brl(v.valor_centavos))}</td><td><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${sit}${acoes}</div></td><td>${esc(FORMA[v.metodo] || 'Mercado Pago')}</td><td class="num">${esc(v.metodo === 'pix_manual' ? v.codigo : (v.mp_payment_id || ''))}</td></tr>`;
    }).join('')
      : '<tr class="vazio"><td colspan="6">Nenhuma venda ainda.</td></tr>';
    $('#tabEventos').innerHTML = (evs || []).length ? evs.map(ev => {
      const t = EVENTO[ev.tipo] || [ev.tipo, ''];
      const d = ev.detalhe || {};
      const extra = d.para ? 'Para ' + d.para : d.payment_id ? 'Pagamento ' + d.payment_id : d.preco_centavos != null ? 'Preço ' + brl(d.preco_centavos) + (d.vendas_abertas ? ', vendas abertas' : ', vendas fechadas') : d.por ? 'Por ' + d.por : '';
      return `<tr><td class="num">${esc(data(ev.quando))}</td><td>${t[1] ? `<span class="tag ${esc(t[1])}">${esc(t[0])}</span>` : esc(t[0])}</td><td>${esc(ev.email || '')}</td><td>${esc(extra)}</td></tr>`;
    }).join('') : '<tr class="vazio"><td colspan="4">Nada registrado ainda.</td></tr>';
    if (!silencio) {
      $('#cfgNome').value = c.nome_produto || '';
      $('#cfgDescricao').value = c.descricao || '';
      $('#cfgPreco').value = c.preco_centavos ? (c.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
      $('#cfgSuporte').value = c.email_suporte || '';
      $('#cfgVendas').checked = !!c.vendas_abertas;
      $('#pgMp').checked = c.aceita_mp !== false; $('#pgPix').checked = !!c.aceita_pix;
      $('#pgChave').value = c.pix_chave || ''; $('#pgNome').value = c.pix_nome || ''; $('#pgCidade').value = c.pix_cidade || '';
    }
    const pend = $('#transferenciaPendente');
    if (c.dono_pendente_email) {
      pend.hidden = false;
      pend.innerHTML = `Aguardando <b>${esc(c.dono_pendente_email)}</b> aceitar até ${esc(data(c.dono_pendente_expira))}. <button class="link" data-act="cancelar-transferencia">Cancelar</button>`;
    } else pend.hidden = true;
  } catch (e) {
    if (!silencio) toast(traduzir(e));
    if (/Apenas o dono/.test(String(e.message))) { pararAuto(); voltar(); }
  }
}
function renderUsuarios() {
  const q = $('#buscaUsuarios').value.trim().toLowerCase();
  let lista = usuarios.filter(u => !q || [u.email, u.nome, u.empresa].some(x => String(x || '').toLowerCase().includes(q)));
  if (filtro === 'online') lista = lista.filter(u => u.online);
  else if (filtro === 'logados') lista = lista.filter(u => u.sessoes > 0);
  else if (filtro === 'acesso') lista = lista.filter(u => u.tem_acesso);
  else if (filtro === 'sem') lista = lista.filter(u => !u.tem_acesso);
  $('#tabUsuarios').innerHTML = lista.length ? lista.map(u => `<tr class="clic" data-act="ver-usuario" data-uid="${esc(u.user_id)}" tabindex="0">
      <td><div class="pessoa"><span class="avatar">${esc(iniciais(u.nome, u.email))}</span><div style="min-width:0"><b>${esc(u.nome || '—')}${u.eh_dono ? ' <span class="tag info">Dono</span>' : ''}</b><small>${esc(u.email)}${u.empresa ? ' · ' + esc(u.empresa) : ''}</small></div></div></td>
      <td>${u.online ? '<span class="tag ok"><span class="dot on"></span>Online</span>' : `<span class="muted">Visto ${esc(haQuanto(u.visto_em))}</span>`}</td>
      <td>${u.tem_acesso ? `<span class="tag ok">${u.origem === 'dono' ? 'Dono' : u.origem === 'manual' ? 'Liberado' : 'Comprou'}</span>` : '<span class="tag">Sem acesso</span>'}</td>
      <td class="n num">${esc(u.sessoes)}</td>
      <td class="num">${esc(data(u.ultimo_login))}</td>
      <td class="num">${esc(dia(u.criado_em))}</td></tr>`).join('')
    : '<tr class="vazio"><td colspan="6">Nenhum usuário encontrado.</td></tr>';
}
let detalheUid = null;
async function verUsuario(uid) {
  detalheUid = uid;
  $('#detalhe').hidden = false;
  $('#detCorpo').innerHTML = '<div class="spinner" style="margin:30px auto"></div>';
  try {
    const p = await rpc('admin_detalhe_usuario', { p_user: uid });
    $('#detAvatar').textContent = iniciais(p.nome, p.email);
    $('#detNome').textContent = p.nome || 'Sem nome';
    $('#detEmail').textContent = p.email;
    const kv = [
      ['Situação', p.online ? '<span class="tag ok"><span class="dot on"></span>Online agora</span>' : 'Visto ' + esc(haQuanto(p.visto_em))],
      ['Acesso', tagAcesso(p)], ['Empresa', esc(p.empresa || '—')], ['Cargo', esc(p.cargo || '—')], ['Telefone', esc(p.telefone || '—')],
      ['CPF/CNPJ', esc(p.documento || '—')], ['Cidade', esc(p.cidade || '—')], ['E-mail confirmado', p.email_confirmado ? 'Sim' : 'Não'],
      ['Conta criada em', esc(data(p.conta_criada_em))], ['Último login', esc(data(p.ultimo_login))]
    ];
    $('#detCorpo').innerHTML = `
      <div class="card"><div class="card-b"><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${p.eh_dono ? '' : `<div style="display:flex;gap:8px;flex-wrap:wrap">${p.acesso && p.acesso.ativo ? '<button class="btn small danger" data-act="det-acesso" data-ativo="0">Bloquear acesso</button>' : '<button class="btn small primary" data-act="det-acesso" data-ativo="1">Liberar acesso</button>'}<button class="btn small" data-act="det-sessoes">Desconectar aparelhos</button></div>`}
      </div></div>
      <div class="card"><div class="card-h"><h2>Aparelhos logados (${(p.sessoes || []).length})</h2></div><ul class="lista-dev">${htmlSessoes(p.sessoes || [])}</ul></div>
      <div class="card"><div class="card-h"><h2>Últimos acessos</h2></div><div class="tabela-w" style="max-height:300px"><table><thead><tr><th>Quando</th><th>O quê</th><th>IP</th><th>Aparelho</th></tr></thead><tbody>${htmlAcessos(p.acessos || [])}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h2>Compras</h2></div><div class="tabela-w"><table><thead><tr><th>Data</th><th class="n">Valor</th><th>Situação</th><th>Mercado Pago</th></tr></thead><tbody>${htmlCompras(p.compras || [])}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h2>Histórico</h2></div><div class="tabela-w" style="max-height:260px"><table><tbody>${(p.eventos || []).length ? p.eventos.map(ev => `<tr><td class="num">${esc(data(ev.quando))}</td><td>${esc((EVENTO[ev.tipo] || [ev.tipo])[0])}</td></tr>`).join('') : '<tr class="vazio"><td>Nada registrado.</td></tr>'}</tbody></table></div></div>`;
  } catch (e) { $('#detCorpo').innerHTML = `<p class="msg erro">${esc(traduzir(e))}</p>`; }
}
function fecharDetalhe() { $('#detalhe').hidden = true; detalheUid = null; }
function lerPreco(s) {
  s = String(s || '').replace(/[R$\s]/g, '');
  if (!s) return null;
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) return NaN;
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Math.round(n * 100);
}
async function salvarLoja(e) {
  e.preventDefault();
  const preco = lerPreco($('#cfgPreco').value);
  const suporte = $('#cfgSuporte').value.trim();
  if (Number.isNaN(preco) || (preco !== null && (preco < 100 || preco > 10000000))) return msg('#msgLoja', 'Preço inválido. Use um valor entre R$ 1,00 e R$ 100.000,00, por exemplo 49,90.', 'erro');
  if (suporte && !EMAIL.test(suporte)) return msg('#msgLoja', 'E-mail de suporte inválido.', 'erro');
  if ($('#cfgVendas').checked && preco === null) return msg('#msgLoja', 'Defina o preço antes de abrir as vendas.', 'erro');
  try {
    await rpc('admin_salvar_config', { p_nome_produto: $('#cfgNome').value.trim(), p_descricao: $('#cfgDescricao').value.trim(), p_preco_centavos: preco, p_vendas_abertas: $('#cfgVendas').checked, p_email_suporte: suporte || null });
    msg('#msgLoja', 'Salvo.', 'ok');
    vitrine = await rpc('config_publica'); preencherVitrine();
    await carregarPainel(true);
  } catch (err) { msg('#msgLoja', traduzir(err), 'erro'); }
}
function semAcento(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
async function salvarPagamentos(e) {
  e.preventDefault();
  let chave = $('#pgChave').value.trim();
  const so = chave.replace(/\D/g, '');
  if (/^[\d.\-\/\s]+$/.test(chave) && (so.length === 11 || so.length === 14)) chave = so; // CPF/CNPJ só com números
  else if (/^\(?\+?\d[\d\s()\-]{9,}$/.test(chave)) chave = '+' + (so.startsWith('55') ? so : '55' + so); // telefone
  const nome = semAcento($('#pgNome').value).replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, 25);
  const cidade = semAcento($('#pgCidade').value).replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, 15);
  try {
    await rpc('admin_salvar_pagamentos', { p_aceita_mp: $('#pgMp').checked, p_aceita_pix: $('#pgPix').checked, p_pix_chave: chave || null, p_pix_nome: nome || null, p_pix_cidade: cidade || null });
    $('#pgChave').value = chave; $('#pgNome').value = nome; $('#pgCidade').value = cidade;
    msg('#msgPagamentos', 'Salvo.' + ($('#pgPix').checked ? ' Antes de vender, faça uma compra de teste por Pix (pagando de outra conta sua) para conferir o nome e o valor no aplicativo do banco.' : ''), 'ok');
    vitrine = await rpc('config_publica'); preencherVitrine();
  } catch (err) { msg('#msgPagamentos', traduzir(err), 'erro'); }
}
async function definirAcesso(email, ativo, onde) {
  try {
    await rpc('admin_definir_acesso', { p_email: email, p_ativo: ativo });
    if (onde) msg(onde, ativo ? 'Acesso liberado para ' + email + '.' : 'Acesso bloqueado para ' + email + '.', 'ok');
    else toast(ativo ? 'Acesso liberado.' : 'Acesso bloqueado.');
    await carregarPainel(true);
    return true;
  } catch (err) { if (onde) msg(onde, traduzir(err), 'erro'); else toast(traduzir(err)); return false; }
}
async function enviarAcesso(e) {
  e.preventDefault();
  const ativo = e.submitter ? e.submitter.dataset.ativo === '1' : true;
  const email = $('#acessoEmail').value.trim().toLowerCase();
  if (!EMAIL.test(email)) return msg('#msgAcesso', 'Digite um e-mail válido.', 'erro');
  if (await definirAcesso(email, ativo, '#msgAcesso')) $('#acessoEmail').value = '';
}
async function transferir(e) {
  e.preventDefault();
  const email = $('#novoDono').value.trim().toLowerCase();
  if (!EMAIL.test(email)) return msg('#msgTransferir', 'Digite um e-mail válido.', 'erro');
  if (!$('#confirmaTransferir').checked) return msg('#msgTransferir', 'Marque a confirmação para continuar.', 'erro');
  try {
    await rpc('admin_transferir_propriedade', { p_email: email });
    msg('#msgTransferir', 'Pronto. Peça para ' + email + ' criar a conta (se ainda não tiver), entrar no site e clicar em “Assumir a loja” em até 7 dias.', 'ok');
    $('#novoDono').value = ''; $('#confirmaTransferir').checked = false;
    await carregarPainel(true);
  } catch (err) { msg('#msgTransferir', traduzir(err), 'erro'); }
}
function csvSeguro(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function baixarVendas() {
  const linhas = [['Data', 'E-mail', 'Valor', 'Forma', 'Situação', 'Código / pagamento']].concat(vendas.map(v => [data(v.criado_em), v.email, (v.valor_centavos / 100).toFixed(2).replace('.', ','), FORMA[v.metodo] || 'Mercado Pago', SITUACAO[v.status] || v.status, v.metodo === 'pix_manual' ? v.codigo : (v.mp_payment_id || '')]));
  baixar('vendas.csv', '\uFEFF' + linhas.map(l => l.map(csvSeguro).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const formaBtn = e.target.closest('[data-forma]');
  if (formaBtn) { escolherForma(formaBtn.dataset.forma); return; }
  const modoBtn = e.target.closest('[data-modo]');
  if (modoBtn) { definirModo(modoBtn.dataset.modo); return; }
  const sec = e.target.closest('[data-psec]');
  if (sec) { mudarSecao(sec.dataset.psec); return; }
  const fil = e.target.closest('[data-filtro]');
  if (fil) { filtro = fil.dataset.filtro; $$('[data-filtro]').forEach(b => b.setAttribute('aria-pressed', String(b === fil))); renderUsuarios(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  switch (el.dataset.act) {
    case 'recarregar': location.reload(); break;
    case 'esqueci': esqueci(); break;
    case 'sair': sair(); break;
    case 'comprar': comprar(); break;
    case 'ja-paguei': jaPaguei(el); break;
    case 'gerar-pix': gerarPix(); break;
    case 'informar-pix': informarPix(); break;
    case 'copiar-pix': copiarPix(); break;
    case 'termos': $('#termos').hidden = false; break;
    case 'fechar-termos': $('#termos').hidden = true; break;
    case 'confirmar-pix': case 'recusar-pix': {
      const aprovar = el.dataset.act === 'confirmar-pix';
      if (!confirm(aprovar ? 'Confirmar que o Pix de ' + el.dataset.valor + ' (código ' + el.dataset.codigo + ') caiu na sua conta? O acesso será liberado.' : 'Recusar este Pix? Faça isso só se o pagamento não caiu na sua conta.')) break;
      try { await rpc('admin_confirmar_pix', { p_compra: el.dataset.id, p_aprovar: aprovar }); toast(aprovar ? 'Pix confirmado. Acesso liberado.' : 'Pix recusado.'); carregarPainel(true); }
      catch (err) { toast(traduzir(err)); }
      break;
    }
    case 'privacidade': $('#privacidade').hidden = false; break;
    case 'fechar-privacidade': $('#privacidade').hidden = true; break;
    case 'perfil': abrirPerfil(); break;
    case 'painel': abrirPainel(); break;
    case 'voltar': voltar(); break;
    case 'ver-senha': { const i = $('#' + el.dataset.alvo); i.type = i.type === 'password' ? 'text' : 'password'; el.setAttribute('aria-label', i.type === 'password' ? 'Mostrar senha' : 'Esconder senha'); break; }
    case 'sair-outros': sairOutros(); break;
    case 'baixar-dados': baixarMeusDados(); break;
    case 'atualizar-painel': carregarPainel(); break;
    case 'baixar-vendas': baixarVendas(); break;
    case 'ver-usuario': verUsuario(el.dataset.uid); break;
    case 'fechar-detalhe': fecharDetalhe(); break;
    case 'det-acesso': {
      const u = usuarios.find(x => x.user_id === detalheUid);
      if (u && await definirAcesso(u.email, el.dataset.ativo === '1')) verUsuario(detalheUid);
      break;
    }
    case 'det-sessoes':
      if (!confirm('Desconectar todos os aparelhos desta pessoa? Ela precisará entrar de novo (vale em até 1 hora).')) break;
      try { const r = await rpc('admin_encerrar_sessoes', { p_user: detalheUid }); toast(r.encerradas + ' aparelho(s) desconectado(s).'); verUsuario(detalheUid); carregarPainel(true); }
      catch (err) { toast(traduzir(err)); }
      break;
    case 'cancelar-transferencia':
      try { await rpc('admin_cancelar_transferencia'); toast('Transferência cancelada.'); carregarPainel(true); } catch (err) { toast(traduzir(err)); }
      break;
    case 'aceitar-propriedade':
      el.disabled = true;
      try { await rpc('aceitar_propriedade'); toast('Agora você é o dono desta loja.'); $('#convite').hidden = true; appAberto = false; perfil = null; await rotear(); }
      catch (err) { toast(traduzir(err)); }
      finally { el.disabled = false; }
      break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#detalhe').hidden) fecharDetalhe();
  if (e.key === 'Escape') { $('#privacidade').hidden = true; $('#termos').hidden = true; }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-act="ver-usuario"]')) verUsuario(e.target.dataset.uid);
});
$('#senha').addEventListener('input', () => {
  if (modo !== 'criar') return;
  const f = forcaSenha($('#senha').value), cores = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];
  $('#forcaBarra').style.width = (f * 25) + '%'; $('#forcaBarra').style.background = cores[f];
  $('#forcaTexto').textContent = ['Senha muito fraca', 'Senha fraca', 'Senha razoável', 'Senha boa', 'Senha forte'][f];
});
$('#buscaUsuarios').addEventListener('input', renderUsuarios);
$('#formEntrar').addEventListener('submit', enviarEntrar);
$('#formNovaSenha').addEventListener('submit', salvarNovaSenha);
$('#formPerfil').addEventListener('submit', salvarPerfil);
$('#formSenha').addEventListener('submit', trocarSenha);
$('#formEmail').addEventListener('submit', trocarEmail);
$('#formExcluir').addEventListener('submit', excluirConta);
$('#formLoja').addEventListener('submit', salvarLoja);
$('#formPagamentos').addEventListener('submit', salvarPagamentos);
$('#formAcesso').addEventListener('submit', enviarAcesso);
$('#formTransferir').addEventListener('submit', transferir);

iniciar();
})();
