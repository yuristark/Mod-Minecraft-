#!/usr/bin/env python3
"""Gera a versão final da Planilha Segura a partir de src/ e vendor/.

Saídas em dist/:
  index.html    página completa para hospedar (CSP com hashes dos scripts)
  _headers      cabeçalhos de segurança para Netlify / Cloudflare Pages
  artifact.html mesma página sem o esqueleto <html>, para publicar como Artifact

Uso: python3 build.py
"""
import base64
import hashlib
import pathlib
import re
import sys

VERSION = "1.0.0"
ROOT = pathlib.Path(__file__).resolve().parent
SRC, DIST = ROOT / "src", ROOT / "dist"
XLSX_FILE = ROOT / "vendor" / "xlsx-0.18.5.full.min.js"


def read(p):
    return p.read_text(encoding="utf-8")


def check_inline(name, text):
    # Um "</script" ou "<script" dentro do conteúdo quebraria a página.
    if re.search(r"</?script", text, re.I):
        sys.exit(f"ERRO: {name} contém '<script' e não pode ser embutido.")


def sha(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def main():
    layout = read(SRC / "layout.html")
    engine = read(SRC / "engine.js").strip()
    app = read(SRC / "app.js").replace("{{VERSION}}", VERSION).strip()
    xlsx = read(XLSX_FILE)
    # As tabelas de codificação da SheetJS têm o caractere U+FFFD dentro de strings.
    # O escape \uFFFD é equivalente em JavaScript e evita o caractere literal no HTML.
    xlsx = xlsx.replace("\ufffd", "\\uFFFD")
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
        sys.exit("ERRO: marcador {{...}} sem substituição no layout.")

    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(body, encoding="utf-8")

    # Na página completa, <title> e <style> do layout vão para o <head>.
    cut = body.index("</style>") + len("</style>")
    head_part, body_part = body[:cut], body[cut:].lstrip("\n")

    csp = "; ".join([
        "default-src 'none'",
        f"script-src {sha(engine_js)} {sha(app_js)}",
        "worker-src blob:",
        "style-src 'unsafe-inline'",
        "img-src data:",
        "connect-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "manifest-src 'none'",
    ])
    page = ("<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
            f"<meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\">\n"
            "<meta name=\"referrer\" content=\"no-referrer\">\n"
            "<meta name=\"description\" content=\"Limpe, padronize e automatize planilhas sem enviar seus dados para nenhum servidor.\">\n"
            "<meta name=\"color-scheme\" content=\"light dark\">\n"
            "<link rel=\"icon\" href=\"data:,\">\n"
            + head_part + "\n</head>\n<body>\n" + body_part + "</body>\n</html>\n")
    (DIST / "index.html").write_text(page, encoding="utf-8")

    headers = "\n".join([
        "/*",
        f"  Content-Security-Policy: {csp}; frame-ancestors 'none'; upgrade-insecure-requests",
        "  X-Frame-Options: DENY",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: no-referrer",
        "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()",
        "  Cross-Origin-Opener-Policy: same-origin",
        "  Cross-Origin-Resource-Policy: same-origin",
        "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
        "  Cache-Control: no-cache",
        "",
    ])
    (DIST / "_headers").write_text(headers, encoding="utf-8")

    print(f"Planilha Segura {VERSION}")
    print(f"  xlsx sha256: {hashlib.sha256(XLSX_FILE.read_bytes()).hexdigest()}")
    for f in ("index.html", "artifact.html", "_headers"):
        print(f"  dist/{f}: {(DIST / f).stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
