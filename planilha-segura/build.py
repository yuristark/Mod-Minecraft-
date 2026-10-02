#!/usr/bin/env python3
"""Gera a versão final do produto a partir de src/, loja/, vendor/ e marca.json.

Saídas em dist/:
  aberto/                  aplicativo sem login (um único arquivo .html, funciona sem internet)
  loja/                    site de vendas: login, compra, perfil e painel do dono (publicar na hospedagem)
  enviar-ao-supabase/      aplicativo protegido: enviar ao Storage do Supabase (depósito "app")
  artifact.html            aplicativo sem o esqueleto <html>, para publicar como Artifact
  pacotes/                 arquivos .zip prontos para entregar:
    <produto>-<versão>-arquivo.zip        o aplicativo + LEIA-ME + licença (para o cliente final)
    <produto>-<versão>-loja-completa.zip  tudo para instalar a loja (para quem compra o negócio)
    clientes/                             pacotes personalizados com o nome de cada cliente

Uso:
  python3 build.py                                   gera tudo
  python3 build.py --cliente "Nome do Cliente" [--email cliente@exemplo.com] [--documento 000.000.000-00]
                                                     gera também o pacote personalizado desse cliente
"""
import argparse
import base64
import datetime
import hashlib
import html
import json
import pathlib
import re
import shutil
import sys
import unicodedata
import zipfile

VERSION = "1.2.0"
ROOT = pathlib.Path(__file__).resolve().parent
SRC, LOJA, DIST = ROOT / "src", ROOT / "loja", ROOT / "dist"
XLSX_FILE = ROOT / "vendor" / "xlsx-0.18.5.full.min.js"
SUPABASE_FILE = ROOT / "vendor" / "supabase-js-2.117.2.umd.js"
QR_FILE = ROOT / "vendor" / "qrcode-generator-1.4.4.js"
NOME_PADRAO, SLOGAN_PADRAO = "Planilha Segura", "Menos rotina. Mais controle."

HEADERS_COMUNS = [
    "  X-Frame-Options: DENY",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    "  Cache-Control: no-cache",
]


def read(p):
    return p.read_text(encoding="utf-8")


def check_inline(name, text):
    # Um "</script" ou "<script" dentro do conteúdo quebraria a página.
    if re.search(r"</?script", text, re.I):
        sys.exit(f"ERRO: {name} contém '<script' e não pode ser embutido.")


def sha(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def slug(texto):
    t = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "produto"


def pagina(body, csp, descricao):
    # <title> e <style> do layout vão para o <head>.
    cut = body.index("</style>") + len("</style>")
    head_part, body_part = body[:cut], body[cut:].lstrip("\n")
    return ("<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
            f"<meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\">\n"
            "<meta name=\"referrer\" content=\"no-referrer\">\n"
            f"<meta name=\"description\" content=\"{html.escape(descricao)}\">\n"
            "<meta name=\"color-scheme\" content=\"light dark\">\n"
            "<link rel=\"icon\" href=\"data:,\">\n"
            + head_part + "\n</head>\n<body>\n" + body_part + "</body>\n</html>\n")


def headers(csp):
    return "\n".join(["/*", f"  Content-Security-Policy: {csp}; frame-ancestors 'none'; upgrade-insecure-requests"]
                     + HEADERS_COMUNS + [""])


def ler_marca():
    m = json.loads(read(ROOT / "marca.json"))
    nome = str(m.get("nome") or NOME_PADRAO).strip()
    slogan = str(m.get("slogan") or SLOGAN_PADRAO).strip()
    # O nome entra em textos do HTML e em strings do JavaScript: só caracteres seguros.
    if not re.fullmatch(r"[A-Za-zÀ-ÿ0-9 .\-]{2,40}", nome):
        sys.exit("ERRO: marca.json → \"nome\" deve ter de 2 a 40 letras, números, espaços, ponto ou hífen.")
    if not re.fullmatch(r"[A-Za-zÀ-ÿ0-9 .,!\-]{0,60}", slogan):
        sys.exit("ERRO: marca.json → \"slogan\" deve ter até 60 letras, números, espaços e . , ! -")
    return {"nome": nome, "slogan": slogan, "vendedor": str(m.get("vendedor") or "").strip(),
            "email_suporte": str(m.get("email_suporte") or "").strip(), "site": str(m.get("site") or "").strip()}


def marcar(texto, marca):
    return texto.replace(NOME_PADRAO, marca["nome"]).replace(SLOGAN_PADRAO, marca["slogan"])


def montar_app(marca, licenca_html=""):
    layout = marcar(read(SRC / "layout.html"), marca)
    engine = read(SRC / "engine.js").strip()
    app = marcar(read(SRC / "app.js"), marca).replace("{{VERSION}}", VERSION).strip()
    xlsxw = marcar(read(SRC / "xlsx.js"), marca).strip()
    xlsx = read(XLSX_FILE)
    # As tabelas de codificação da SheetJS têm o caractere U+FFFD dentro de strings.
    # O escape � é equivalente em JavaScript e evita o caractere literal no HTML.
    xlsx = xlsx.replace("�", "\\uFFFD")
    for n, t in (("engine.js", engine), ("app.js", app), ("xlsx", xlsx), ("xlsx.js", xlsxw)):
        check_inline(n, t)
    engine_js, app_js, xlsxw_js = "\n" + engine + "\n", "\n" + app + "\n", "\n" + xlsxw + "\n"
    body = (layout
            .replace("{{VERSION}}", VERSION)
            .replace("{{LICENCA}}", licenca_html)
            .replace("{{XLSX}}", xlsx)
            .replace("{{ENGINE}}", '<script id="engine">' + engine_js + "</script>")
            .replace("{{XLSXW}}", "<script>" + xlsxw_js + "</script>")
            .replace("{{APP}}", "<script>" + app_js + "</script>"))
    if re.search(r"\{\{(VERSION|LICENCA|XLSX|XLSXW|ENGINE|APP)\}\}", body.replace(xlsx, "")):
        sys.exit("ERRO: marcador {{...}} sem substituição no layout do aplicativo.")
    hashes = f"{sha(engine_js)} {sha(xlsxw_js)} {sha(app_js)}"
    csp = "; ".join([
        "default-src 'none'", f"script-src {hashes}", "worker-src blob:", "style-src 'unsafe-inline'",
        "img-src data:", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'",
        "frame-src 'none'", "manifest-src 'none'",
    ])
    page = pagina(body, csp, "Limpe, padronize e automatize planilhas sem enviar seus dados para nenhum servidor.")
    return body, page, hashes, csp


def texto_leia_me(marca, cliente=None):
    contato = marca["email_suporte"] or "o e-mail de quem vendeu o produto"
    nome = marca["nome"]
    linhas = [
        f"{nome} {VERSION}",
        "=" * 60,
        "",
        (f"Licenciado para: {cliente}" if cliente else "Licença de uso individual"),
        "",
        "COMO ABRIR",
        f"1. Extraia este .zip (clique com o botão direito > Extrair tudo).",
        f"2. Dê dois cliques no arquivo \"{nome}.html\".",
        "   Ele abre no seu navegador (Chrome, Edge, Firefox ou Safari).",
        "3. Pronto. Não precisa instalar nada e funciona até sem internet.",
        "",
        "DICA: arraste o arquivo para a barra de favoritos ou crie um atalho na",
        "área de trabalho para abrir mais rápido. Use sempre no computador: no",
        "celular funciona, mas planilhas grandes ficam melhores numa tela maior.",
        "",
        "PRIMEIROS PASSOS",
        "- Clique em \"Abrir planilha\" (ou arraste o arquivo para a tela).",
        "- Veja a nota de saúde e clique em \"Corrigir tudo\", ou escolha um",
        "  modelo em \"Modelos de receita\".",
        "- Confira o resultado e clique em \"Baixar > Excel formatado\".",
        "- Para automatizar no Google Sheets, abra \"Automações\".",
        "- Dúvidas: aba \"Guia e boas práticas\" dentro do aplicativo.",
        "",
        "PRIVACIDADE",
        "Suas planilhas são processadas só no seu computador. Nada é enviado",
        "para a internet. O arquivo original nunca é alterado.",
        "",
        "SUPORTE",
        f"Fale com {contato}.",
        "",
        "Leia também LICENCA-DE-USO.txt.",
        "",
    ]
    return "\r\n".join(linhas)


def texto_licenca(marca, cliente=None, email=None, documento=None):
    vendedor = marca["vendedor"] or "o vendedor"
    contato = marca["email_suporte"] or "o e-mail de suporte do vendedor"
    licenciado = cliente or "a pessoa ou empresa que comprou esta cópia"
    extra = ", ".join(x for x in (email, documento) if x)
    hoje = datetime.date.today().strftime("%d/%m/%Y")
    linhas = [
        f"LICENÇA DE USO — {marca['nome']} {VERSION}",
        "=" * 60,
        "",
        f"Licenciante: {vendedor}",
        f"Licenciado: {licenciado}" + (f" ({extra})" if extra else ""),
        f"Data: {hoje}",
        "",
        "1. Esta licença dá direito de usar o aplicativo, por tempo indeterminado,",
        "   para atividades próprias do licenciado (pessoa física ou a sua empresa),",
        "   em quantos computadores ele usar.",
        "2. Não é permitido revender, emprestar, distribuir, publicar na internet",
        "   ou compartilhar o arquivo com outras pessoas ou empresas.",
        "3. O aplicativo funciona no navegador e não envia os dados das planilhas",
        "   para nenhum servidor. O licenciado é responsável por conferir os",
        "   resultados antes de usá-los e por guardar os arquivos originais.",
        "4. Direito de arrependimento: o licenciado pode desistir em até 7 dias da",
        "   compra e receber o valor de volta (Código de Defesa do Consumidor,",
        "   art. 49), apagando todas as cópias do arquivo.",
        f"5. Suporte e pedidos: {contato}.",
        "",
        "Componentes de terceiros incluídos: SheetJS Community Edition (Apache 2.0).",
        "",
    ]
    return "\r\n".join(linhas)


def escrever_zip(destino, arquivos):
    destino.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for nome, conteudo in arquivos:
            info = zipfile.ZipInfo(nome, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, conteudo.encode("utf-8") if isinstance(conteudo, str) else conteudo)


def pacote_cliente(marca, cliente, email=None, documento=None):
    rotulo = html.escape(cliente) + (f" · {html.escape(email)}" if email else "")
    licenca_html = f'<p class="ver">Licenciado para: {rotulo}</p>'
    _, page, _, _ = montar_app(marca, licenca_html)
    destino = DIST / "pacotes" / "clientes" / f"{slug(marca['nome'])}-{VERSION}-{slug(cliente)}.zip"
    escrever_zip(destino, [
        (f"{marca['nome']}.html", page),
        ("LEIA-ME.txt", texto_leia_me(marca, cliente)),
        ("LICENCA-DE-USO.txt", texto_licenca(marca, cliente, email, documento)),
    ])
    return destino


def main():
    ap = argparse.ArgumentParser(description="Gera o produto e os pacotes de entrega.")
    ap.add_argument("--cliente", help="nome do cliente para gerar um pacote personalizado")
    ap.add_argument("--email", help="e-mail do cliente (opcional)")
    ap.add_argument("--documento", help="CPF ou CNPJ do cliente (opcional, vai só na licença)")
    args = ap.parse_args()
    marca = ler_marca()

    # ---------------- aplicativo
    body, app_page, app_hashes, csp_app = montar_app(marca)

    if DIST.exists():
        for velho in ("index.html", "_headers"):  # saídas de versões antigas
            (DIST / velho).unlink(missing_ok=True)
        for pasta in ("aberto", "loja", "enviar-ao-supabase"):
            shutil.rmtree(DIST / pasta, ignore_errors=True)
        for z in (DIST / "pacotes").glob("*.zip"):
            z.unlink()
    for pasta in ("aberto", "loja", "enviar-ao-supabase", "pacotes"):
        (DIST / pasta).mkdir(parents=True, exist_ok=True)

    (DIST / "artifact.html").write_text(body, encoding="utf-8")
    (DIST / "aberto" / "index.html").write_text(app_page, encoding="utf-8")
    (DIST / "aberto" / "_headers").write_text(headers(csp_app), encoding="utf-8")
    (DIST / "enviar-ao-supabase" / "planilha-segura.html").write_text(app_page, encoding="utf-8")

    # ---------------- loja
    loja_layout = marcar(read(LOJA / "layout.html"), marca)
    loja_js = "\n" + marcar(read(LOJA / "loja.js"), marca).strip() + "\n"
    pix_js = "\n" + read(LOJA / "pix.js").strip() + "\n"
    qr_js = "\n" + read(QR_FILE).strip() + "\n"
    supa_js = "\n" + read(SUPABASE_FILE).strip() + "\n"
    for n, t in (("loja.js", loja_js), ("pix.js", pix_js), ("qrcode", qr_js), ("supabase-js", supa_js)):
        check_inline(n, t)
    loja_body = (loja_layout
                 .replace("{{SUPABASE}}", "<!-- supabase-js 2.117.2\n" + read(ROOT / "vendor" / "LICENSE-supabase-js.txt").replace("--", "- -").strip()
                          + "\n-->\n<script>" + supa_js + "</script>")
                 .replace("{{QR}}", "<!-- qrcode-generator 1.4.4 (MIT), Copyright (c) 2009 Kazuhiko Arase. Licença completa em vendor/LICENSE-qrcode-generator.txt -->\n<script>" + qr_js + "</script>")
                 .replace("{{PIX}}", "<script>" + pix_js + "</script>")
                 .replace("{{LOJA}}", "<script>" + loja_js + "</script>"))
    resto = loja_body
    for t in (supa_js, qr_js, pix_js, loja_js):
        resto = resto.replace(t, "")
    if re.search(r"\{\{(SUPABASE|QR|PIX|LOJA)\}\}", resto):
        sys.exit("ERRO: marcador {{...}} sem substituição no layout da loja.")
    # O aplicativo roda num iframe srcdoc, que herda esta política: os hashes dele também entram aqui.
    csp_loja = "; ".join([
        "default-src 'none'", f"script-src {sha(supa_js)} {sha(qr_js)} {sha(pix_js)} {sha(loja_js)} {app_hashes}", "worker-src blob:",
        "style-src 'unsafe-inline'", "img-src data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'", "manifest-src 'none'",
    ])
    loja_page = pagina(loja_body, csp_loja, f"Acesso vitalício ao {marca['nome']}: limpe e automatize planilhas sem enviar seus dados.")
    (DIST / "loja" / "index.html").write_text(loja_page, encoding="utf-8")
    (DIST / "loja" / "_headers").write_text(headers(csp_loja), encoding="utf-8")
    # Endereço e chave pública do Supabase do dono (edite loja/config.json uma vez; cada build copia).
    shutil.copyfile(LOJA / "config.json", DIST / "loja" / "config.json")

    # ---------------- pacotes de entrega
    base = f"{slug(marca['nome'])}-{VERSION}"
    escrever_zip(DIST / "pacotes" / f"{base}-arquivo.zip", [
        (f"{marca['nome']}.html", app_page),
        ("LEIA-ME.txt", texto_leia_me(marca)),
        ("LICENCA-DE-USO.txt", texto_licenca(marca)),
    ])
    loja_arqs = [
        ("1-hospedagem (publicar no Netlify)/index.html", loja_page),
        ("1-hospedagem (publicar no Netlify)/_headers", headers(csp_loja)),
        ("1-hospedagem (publicar no Netlify)/config.json", read(LOJA / "config.json")),
        ("2-enviar-ao-supabase (Storage, depósito app)/planilha-segura.html", app_page),
        ("3-banco-de-dados (SQL Editor do Supabase)/0001_planilha_segura.sql", read(ROOT / "supabase" / "migrations" / "0001_planilha_segura.sql")),
        ("4-funcoes (Edge Functions do Supabase)/criar-pagamento/index.ts", read(ROOT / "supabase" / "functions" / "criar-pagamento" / "index.ts")),
        ("4-funcoes (Edge Functions do Supabase)/webhook-mp/index.ts", read(ROOT / "supabase" / "functions" / "webhook-mp" / "index.ts")),
        ("4-funcoes (Edge Functions do Supabase)/config.toml", read(ROOT / "supabase" / "config.toml")),
        ("MANUAL-DO-DONO.md", read(ROOT / "MANUAL-DO-DONO.md")),
        ("licencas-de-terceiros/SheetJS (Apache-2.0).txt", read(ROOT / "vendor" / "LICENSE-sheetjs.txt")),
        ("licencas-de-terceiros/supabase-js (MIT).txt", read(ROOT / "vendor" / "LICENSE-supabase-js.txt")),
        ("licencas-de-terceiros/qrcode-generator (MIT).txt", read(ROOT / "vendor" / "LICENSE-qrcode-generator.txt")),
    ]
    escrever_zip(DIST / "pacotes" / f"{base}-loja-completa.zip", loja_arqs)
    if args.cliente:
        if not re.fullmatch(r"[^<>\"'`\\]{2,80}", args.cliente) or (args.email and not re.fullmatch(r"[^@\s<>\"']+@[^@\s<>\"']+\.[^@\s<>\"']+", args.email)):
            sys.exit("ERRO: nome do cliente ou e-mail inválido.")
        destino = pacote_cliente(marca, args.cliente.strip(), args.email, args.documento)
        print(f"Pacote do cliente: {destino.relative_to(ROOT)}")

    print(f"{marca['nome']} {VERSION}")
    print(f"  xlsx sha256:     {hashlib.sha256(XLSX_FILE.read_bytes()).hexdigest()}")
    print(f"  supabase sha256: {hashlib.sha256(SUPABASE_FILE.read_bytes()).hexdigest()}")
    print(f"  qrcode sha256:   {hashlib.sha256(QR_FILE.read_bytes()).hexdigest()}")
    for f in sorted(p for p in DIST.rglob("*") if p.is_file() and "clientes" not in p.parts):
        print(f"  {f.relative_to(ROOT)}: {f.stat().st_size:,} bytes")
    if not marca["email_suporte"]:
        print("AVISO: preencha \"email_suporte\" e \"vendedor\" em marca.json para aparecerem no LEIA-ME e na licença.")


if __name__ == "__main__":
    main()
