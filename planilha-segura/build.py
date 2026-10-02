#!/usr/bin/env python3
"""Gera a versão final da Planilha Segura a partir de src/, loja/ e vendor/.

Saídas em dist/:
  aberto/                  aplicativo sem login (uso próprio ou demonstração)
  loja/                    site de vendas: login, compra, painel do dono (publicar na hospedagem)
  enviar-ao-supabase/      aplicativo protegido: enviar ao Storage do Supabase (depósito "app")
  artifact.html            aplicativo sem o esqueleto <html>, para publicar como Artifact

Uso: python3 build.py
"""
import base64
import hashlib
import pathlib
import re
import shutil
import sys

VERSION = "1.0.0"
ROOT = pathlib.Path(__file__).resolve().parent
SRC, LOJA, DIST = ROOT / "src", ROOT / "loja", ROOT / "dist"
XLSX_FILE = ROOT / "vendor" / "xlsx-0.18.5.full.min.js"
SUPABASE_FILE = ROOT / "vendor" / "supabase-js-2.117.2.umd.js"

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


def pagina(body, csp, descricao):
    # <title> e <style> do layout vão para o <head>.
    cut = body.index("</style>") + len("</style>")
    head_part, body_part = body[:cut], body[cut:].lstrip("\n")
    return ("<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
            f"<meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\">\n"
            "<meta name=\"referrer\" content=\"no-referrer\">\n"
            f"<meta name=\"description\" content=\"{descricao}\">\n"
            "<meta name=\"color-scheme\" content=\"light dark\">\n"
            "<link rel=\"icon\" href=\"data:,\">\n"
            + head_part + "\n</head>\n<body>\n" + body_part + "</body>\n</html>\n")


def headers(csp):
    return "\n".join(["/*", f"  Content-Security-Policy: {csp}; frame-ancestors 'none'; upgrade-insecure-requests"]
                     + HEADERS_COMUNS + [""])


def main():
    # ---------------- aplicativo
    layout = read(SRC / "layout.html")
    engine = read(SRC / "engine.js").strip()
    app = read(SRC / "app.js").replace("{{VERSION}}", VERSION).strip()
    xlsx = read(XLSX_FILE)
    # As tabelas de codificação da SheetJS têm o caractere U+FFFD dentro de strings.
    # O escape � é equivalente em JavaScript e evita o caractere literal no HTML.
    xlsx = xlsx.replace("�", "\\uFFFD")
    for n, t in (("engine.js", engine), ("app.js", app), ("xlsx", xlsx)):
        check_inline(n, t)

    engine_js = "\n" + engine + "\n"
    app_js = "\n" + app + "\n"
    body = (layout
            .replace("{{VERSION}}", VERSION)
            .replace("{{XLSX}}", xlsx)
            .replace("{{ENGINE}}", '<script id="engine">' + engine_js + "</script>")
            .replace("{{APP}}", "<script>" + app_js + "</script>"))
    if re.search(r"\{\{(VERSION|XLSX|ENGINE|APP)\}\}", body.replace(xlsx, "")):
        sys.exit("ERRO: marcador {{...}} sem substituição no layout do aplicativo.")

    app_hashes = f"{sha(engine_js)} {sha(app_js)}"
    csp_app = "; ".join([
        "default-src 'none'", f"script-src {app_hashes}", "worker-src blob:", "style-src 'unsafe-inline'",
        "img-src data:", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'",
        "frame-src 'none'", "manifest-src 'none'",
    ])
    app_page = pagina(body, csp_app, "Limpe, padronize e automatize planilhas sem enviar seus dados para nenhum servidor.")

    if DIST.exists():
        for velho in ("index.html", "_headers"):  # saídas da versão anterior
            (DIST / velho).unlink(missing_ok=True)
        for pasta in ("aberto", "loja", "enviar-ao-supabase"):
            shutil.rmtree(DIST / pasta, ignore_errors=True)
    for pasta in ("aberto", "loja", "enviar-ao-supabase"):
        (DIST / pasta).mkdir(parents=True, exist_ok=True)

    (DIST / "artifact.html").write_text(body, encoding="utf-8")
    (DIST / "aberto" / "index.html").write_text(app_page, encoding="utf-8")
    (DIST / "aberto" / "_headers").write_text(headers(csp_app), encoding="utf-8")
    (DIST / "enviar-ao-supabase" / "planilha-segura.html").write_text(app_page, encoding="utf-8")

    # ---------------- loja
    loja_layout = read(LOJA / "layout.html")
    loja_js = "\n" + read(LOJA / "loja.js").strip() + "\n"
    supa_js = "\n" + read(SUPABASE_FILE).strip() + "\n"
    for n, t in (("loja.js", loja_js), ("supabase-js", supa_js)):
        check_inline(n, t)
    loja_body = (loja_layout
                 .replace("{{SUPABASE}}", "<!-- supabase-js 2.117.2\n" + read(ROOT / "vendor" / "LICENSE-supabase-js.txt").replace("--", "- -").strip()
                          + "\n-->\n<script>" + supa_js + "</script>")
                 .replace("{{LOJA}}", "<script>" + loja_js + "</script>"))
    if re.search(r"\{\{(SUPABASE|LOJA)\}\}", loja_body.replace(supa_js, "").replace(loja_js, "")):
        sys.exit("ERRO: marcador {{...}} sem substituição no layout da loja.")
    # O aplicativo roda num iframe srcdoc, que herda esta política: os hashes dele também entram aqui.
    csp_loja = "; ".join([
        "default-src 'none'", f"script-src {sha(supa_js)} {sha(loja_js)} {app_hashes}", "worker-src blob:",
        "style-src 'unsafe-inline'", "img-src data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'", "manifest-src 'none'",
    ])
    (DIST / "loja" / "index.html").write_text(
        pagina(loja_body, csp_loja, "Acesso vitalício à Planilha Segura: limpe e automatize planilhas sem enviar seus dados."),
        encoding="utf-8")
    (DIST / "loja" / "_headers").write_text(headers(csp_loja), encoding="utf-8")
    # Endereço e chave pública do Supabase do dono (edite loja/config.json uma vez; cada build copia).
    shutil.copyfile(LOJA / "config.json", DIST / "loja" / "config.json")

    print(f"Planilha Segura {VERSION}")
    print(f"  xlsx sha256:     {hashlib.sha256(XLSX_FILE.read_bytes()).hexdigest()}")
    print(f"  supabase sha256: {hashlib.sha256(SUPABASE_FILE.read_bytes()).hexdigest()}")
    for f in sorted(p for p in DIST.rglob("*") if p.is_file()):
        print(f"  {f.relative_to(ROOT)}: {f.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
