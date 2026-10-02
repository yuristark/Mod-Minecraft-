(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MP_URL = /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.[a-z]{2})?\//i;
const SITE = location.origin + location.pathname;

let sb = null, conf = null, vitrine = null, status = null;
let modo = 'entrar', recuperando = false, appAberto = false, retornoPagamento = null, espera = null;

/* ---------- utilidades ---------- */
const TELAS = ['carregando', 'erro', 'entrar', 'nova-senha', 'comprar', 'app', 'painel'];
function mostrar(t) { TELAS.forEach(x => { $('#t-' + x).hidden = x !== t; }); }
function carregando(msg) { $('#carregandoMsg').textContent = msg || 'Carregando…'; mostrar('carregando'); }
function falhaGeral(msg) { $('#erroMsg').textContent = msg; mostrar('erro'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 5000); }
function msg(id, texto, tipo) { const el = $(id); el.textContent = texto || ''; el.className = 'msg' + (tipo ? ' ' + tipo : ''); }

const TRADUCOES = [
  [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/Email not confirmed/i, 'Confirme seu e-mail primeiro. Procure a mensagem de confirmação na sua caixa de entrada (e no spam).'],
  [/User already registered/i, 'Já existe uma conta com este e-mail. Use “Entrar”.'],
  [/Password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas seguidas. Aguarde alguns minutos.'],
  [/New password should be different/i, 'A nova senha precisa ser diferente da anterior.'],
  [/weak|pwned|leaked/i, 'Senha fraca ou já vazada na internet. Escolha outra.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Sem conexão. Verifique a internet e tente de novo.'],
  [/Could not find the function|does not exist|schema cache/i, 'O banco de dados não está atualizado. O dono precisa rodar o arquivo SQL do manual.'],
  [/permission denied/i, 'Sem permissão para fazer isso.']
];
function traduzir(e) {
  const m = String(e && e.message || e || '');
  for (const [re, t] of TRADUCOES) if (re.test(m)) return t;
  // Mensagens escritas por nós (funções do banco e do servidor) já estão em português.
  return e && e.amigavel && m.length < 300 ? m : 'Algo deu errado. Tente de novo.';
}
function amigavel(texto) { const e = new Error(texto); e.amigavel = true; return e; }
async function rpc(nome, args) {
  const { data: d, error } = await sb.rpc(nome, args || {});
  if (error) throw (error.code === 'P0001' || error.code === '42501') ? amigavel(error.message) : new Error(error.message);
  return d;
}

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
  carregando();
  const q = new URLSearchParams(location.search);
  retornoPagamento = q.get('pagamento');
  try {
    conf = await lerConfig();
  } catch (e) { falhaGeral(e.message); return; }
  sb = supabase.createClient(conf.url, conf.chave, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'PASSWORD_RECOVERY') { recuperando = true; mostrar('nova-senha'); }
  });
  try { vitrine = await rpc('config_publica'); }
  catch (e) { falhaGeral('Não foi possível falar com o servidor. ' + traduzir(e)); return; }
  preencherVitrine();
  // limpa ?code= e ?pagamento= da barra de endereço
  if (location.search) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  await rotear();
}

function preencherVitrine() {
  document.querySelectorAll('.nomeProduto').forEach(el => { el.textContent = vitrine.nome_produto; });
  document.title = vitrine.nome_produto;
  $('#descricaoProduto').textContent = vitrine.descricao || '';
  $('#descricaoProduto').hidden = !vitrine.descricao;
  $('#precoProduto').textContent = vitrine.preco_centavos ? brl(vitrine.preco_centavos) : '—';
  $('#semDono').hidden = !!vitrine.tem_dono;
}

async function rotear() {
  if (recuperando) { mostrar('nova-senha'); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { appAberto = false; $('#convite').hidden = true; mostrar('entrar'); return; }
  try { status = await rpc('meu_status'); }
  catch (e) { falhaGeral('Não foi possível conferir seu acesso. ' + traduzir(e)); return; }
  $('#convite').hidden = !status.convite_propriedade;
  $('#contaEmail').textContent = status.email || '';
  $('#btnPainel').hidden = !status.eh_dono;
  if (status.tem_acesso) { pararEspera(); await abrirApp(); }
  else mostrarCompra();
}

/* ---------- entrar ---------- */
function definirModo(m) {
  modo = m;
  document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
  $('#campoSenha2').hidden = m !== 'criar';
  $('#btnEntrar').textContent = m === 'criar' ? 'Criar conta' : 'Entrar';
  $('#btnEsqueci').hidden = m === 'criar';
  $('#senha').autocomplete = m === 'criar' ? 'new-password' : 'current-password';
  msg('#msgEntrar', '');
}
async function enviarEntrar(e) {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase(), senha = $('#senha').value;
  if (!EMAIL.test(email)) return msg('#msgEntrar', 'Digite um e-mail válido.', 'erro');
  if (senha.length < 8) return msg('#msgEntrar', 'A senha precisa ter pelo menos 8 caracteres.', 'erro');
  const btn = $('#btnEntrar'); btn.disabled = true;
  try {
    if (modo === 'criar') {
      if (senha !== $('#senha2').value) { msg('#msgEntrar', 'As senhas não são iguais.', 'erro'); return; }
      const { data: d, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: SITE } });
      if (error) throw error;
      if (!d.session) { msg('#msgEntrar', 'Conta criada. Enviamos um link de confirmação para ' + email + '. Abra o e-mail e clique no link para continuar.', 'ok'); return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
    $('#senha').value = ''; $('#senha2').value = '';
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
    toast('Senha alterada.');
    carregando(); await rotear();
  } catch (err) { msg('#msgNovaSenha', traduzir(err), 'erro'); }
}
async function sair() {
  try { await sb.auth.signOut(); } catch (e) {}
  location.replace(location.pathname); // descarta o aplicativo da memória
}

/* ---------- compra ---------- */
function mostrarCompra() {
  const abertas = !!vitrine.vendas_abertas;
  $('#blocoVenda').hidden = !abertas;
  $('#btnComprar').hidden = !abertas;
  $('#btnComprar').textContent = abertas ? 'Comprar por ' + brl(vitrine.preco_centavos) : 'Comprar acesso';
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
  mostrar('comprar');
}
function esperarLiberacao() {
  if (espera) return;
  let tentativas = 0;
  const passo = async () => {
    tentativas++;
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
  mostrar('app');
}

/* ---------- painel do dono ---------- */
const SITUACAO = { aprovada: 'Aprovada', pendente: 'Aguardando', recusada: 'Recusada', cancelada: 'Cancelada', reembolsada: 'Reembolsada', contestada: 'Contestada', divergente: 'Valor diferente' };
const EVENTO = {
  compra_aprovada: ['Venda aprovada', 'aprovada'], compra_recusada: ['Pagamento recusado', ''], compra_cancelada: ['Pagamento cancelado', ''],
  compra_reembolsada: ['Reembolso: acesso retirado', 'reembolsada'], compra_contestada: ['Contestação no cartão: acesso retirado', 'contestada'],
  compra_divergente: ['Valor pago diferente do preço: confira', 'divergente'], compra_pendente: ['Pagamento aguardando', ''],
  pagamento_duplicado: ['Cobrança em dobro: reembolse uma no Mercado Pago', 'divergente'],
  acesso_liberado: ['Acesso liberado manualmente', 'aprovada'], acesso_bloqueado: ['Acesso bloqueado manualmente', 'cancelada'],
  config_alterada: ['Configuração da loja alterada', ''], transferencia_iniciada: ['Transferência de dono iniciada', ''],
  transferencia_cancelada: ['Transferência cancelada', ''], propriedade_transferida: ['Novo dono assumiu a loja', 'aprovada'],
  dono_indicado_pelo_sql: ['Dono indicado pelo SQL Editor', '']
};
let vendas = [];
async function abrirPainel() {
  mostrar('painel');
  window.scrollTo(0, 0);
  await carregarPainel();
}
async function carregarPainel() {
  try {
    const [res, comp, aces, evs] = await Promise.all([rpc('admin_resumo'), rpc('admin_listar_compras', { p_limite: 500 }), rpc('admin_listar_acessos'), rpc('admin_listar_eventos', { p_limite: 100 })]);
    vendas = comp || [];
    const c = res.config;
    $('#painelDono').textContent = 'Dono atual: ' + (c.dono_email || '');
    $('#metricas').innerHTML = `
      <div class="metrica"><span>Vendas aprovadas</span><b class="num">${esc(Number(res.vendas_aprovadas).toLocaleString('pt-BR'))}</b></div>
      <div class="metrica"><span>Receita bruta</span><b class="num">${esc(brl(res.receita_centavos))}</b></div>
      <div class="metrica"><span>Acessos ativos</span><b class="num">${esc(Number(res.acessos_ativos).toLocaleString('pt-BR'))}</b></div>
      <div class="metrica${res.pendencias ? ' alerta' : ''}"><span>Para conferir</span><b class="num">${esc(res.pendencias)}</b></div>`;
    $('#cfgNome').value = c.nome_produto || '';
    $('#cfgDescricao').value = c.descricao || '';
    $('#cfgPreco').value = c.preco_centavos ? (c.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
    $('#cfgSuporte').value = c.email_suporte || '';
    $('#cfgVendas').checked = !!c.vendas_abertas;
    const pend = $('#transferenciaPendente');
    if (c.dono_pendente_email) {
      pend.hidden = false;
      pend.innerHTML = `Aguardando <b>${esc(c.dono_pendente_email)}</b> aceitar até ${esc(data(c.dono_pendente_expira))}. <button class="link" data-act="cancelar-transferencia">Cancelar</button>`;
    } else pend.hidden = true;
    $('#tabAcessos').innerHTML = (aces || []).length ? aces.map(a => `<tr><td>${esc(a.email)}</td><td><span class="tag ${a.ativo ? 'aprovada' : 'cancelada'}">${a.ativo ? 'Liberado' : 'Bloqueado'}</span></td><td>${a.origem === 'compra' ? 'Compra' : 'Manual'}</td><td class="num">${esc(data(a.atualizado_em))}</td></tr>`).join('')
      : '<tr class="vazio"><td colspan="4">Ninguém com acesso ainda.</td></tr>';
    $('#tabVendas').innerHTML = vendas.length ? vendas.map(v => `<tr><td class="num">${esc(data(v.criado_em))}</td><td>${esc(v.email)}</td><td class="n num">${esc(brl(v.valor_centavos))}</td><td><span class="tag ${esc(v.status)}">${esc(SITUACAO[v.status] || v.status)}</span></td><td class="num">${esc(v.mp_payment_id || '')}</td></tr>`).join('')
      : '<tr class="vazio"><td colspan="5">Nenhuma venda ainda.</td></tr>';
    $('#tabEventos').innerHTML = (evs || []).length ? evs.map(ev => {
      const t = EVENTO[ev.tipo] || [ev.tipo, ''];
      const d = ev.detalhe || {};
      const extra = d.para ? 'Para ' + d.para : d.payment_id ? 'Pagamento ' + d.payment_id : d.preco_centavos != null ? 'Preço ' + brl(d.preco_centavos) + (d.vendas_abertas ? ', vendas abertas' : ', vendas fechadas') : d.por ? 'Por ' + d.por : '';
      return `<tr><td class="num">${esc(data(ev.quando))}</td><td>${t[1] ? `<span class="tag ${esc(t[1])}">${esc(t[0])}</span>` : esc(t[0])}</td><td>${esc(ev.email || '')}</td><td>${esc(extra)}</td></tr>`;
    }).join('') : '<tr class="vazio"><td colspan="4">Nada registrado ainda.</td></tr>';
  } catch (e) {
    toast(traduzir(e));
    if (/Apenas o dono/.test(String(e.message))) { appAberto ? mostrar('app') : rotear(); }
  }
}
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
    await carregarPainel();
  } catch (err) { msg('#msgLoja', traduzir(err), 'erro'); }
}
async function definirAcesso(e) {
  e.preventDefault();
  const ativo = e.submitter ? e.submitter.dataset.ativo === '1' : true;
  const email = $('#acessoEmail').value.trim().toLowerCase();
  if (!EMAIL.test(email)) return msg('#msgAcesso', 'Digite um e-mail válido.', 'erro');
  try {
    await rpc('admin_definir_acesso', { p_email: email, p_ativo: ativo });
    msg('#msgAcesso', ativo ? 'Acesso liberado para ' + email + '.' : 'Acesso bloqueado para ' + email + '.', 'ok');
    $('#acessoEmail').value = '';
    await carregarPainel();
  } catch (err) { msg('#msgAcesso', traduzir(err), 'erro'); }
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
    await carregarPainel();
  } catch (err) { msg('#msgTransferir', traduzir(err), 'erro'); }
}
function baixarVendas() {
  const seguro = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const linhas = [['Data', 'E-mail', 'Valor', 'Situação', 'Pagamento Mercado Pago']].concat(vendas.map(v => [data(v.criado_em), v.email, (v.valor_centavos / 100).toFixed(2).replace('.', ','), SITUACAO[v.status] || v.status, v.mp_payment_id || '']));
  const blob = new Blob(['﻿' + linhas.map(l => l.map(seguro).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'vendas.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const pop = $('#contaPop');
  if (!e.target.closest('.conta') && !pop.hidden) { pop.hidden = true; $('#contaBtn').setAttribute('aria-expanded', 'false'); }
  const modoBtn = e.target.closest('[data-modo]');
  if (modoBtn) { definirModo(modoBtn.dataset.modo); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  switch (el.dataset.act) {
    case 'recarregar': location.reload(); break;
    case 'esqueci': esqueci(); break;
    case 'sair': sair(); break;
    case 'comprar': comprar(); break;
    case 'conta': pop.hidden = !pop.hidden; el.setAttribute('aria-expanded', String(!pop.hidden)); break;
    case 'painel': pop.hidden = true; abrirPainel(); break;
    case 'voltar-app': appAberto ? mostrar('app') : rotear(); break;
    case 'atualizar-painel': carregarPainel(); break;
    case 'baixar-vendas': baixarVendas(); break;
    case 'cancelar-transferencia':
      try { await rpc('admin_cancelar_transferencia'); toast('Transferência cancelada.'); carregarPainel(); } catch (err) { toast(traduzir(err)); }
      break;
    case 'aceitar-propriedade':
      el.disabled = true;
      try { await rpc('aceitar_propriedade'); toast('Agora você é o dono desta loja.'); $('#convite').hidden = true; appAberto = false; await rotear(); }
      catch (err) { toast(traduzir(err)); }
      finally { el.disabled = false; }
      break;
  }
});
$('#formEntrar').addEventListener('submit', enviarEntrar);
$('#formNovaSenha').addEventListener('submit', salvarNovaSenha);
$('#formLoja').addEventListener('submit', salvarLoja);
$('#formAcesso').addEventListener('submit', definirAcesso);
$('#formTransferir').addEventListener('submit', transferir);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#contaPop').hidden = true; $('#contaBtn').setAttribute('aria-expanded', 'false'); } });

iniciar();
})();
