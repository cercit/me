"""Builds the resume PDF from tools/resume-content.json (same file as resume.html).
Run: python tools/build-resume-pdf.py   (needs playwright + Microsoft Edge)"""
import json, shutil, tempfile
from pathlib import Path
from html import escape as e
from playwright.sync_api import sync_playwright

TOOLS = Path(__file__).resolve().parent
SITE = TOOLS.parent
R = json.loads((TOOLS / 'resume-content.json').read_text(encoding='utf-8-sig'))

def ul(items): return '<ul>'+''.join(f'<li>{e(b)}</li>' for b in items)+'</ul>' if items else ''
def h(t): return f'<h2>{e(t)}</h2>'
def link(c): return f'<a href="{e(c["url"])}">{e(c["label"])}</a>' if c.get('url') else e(c['label'])
contact = ' | '.join([link(c) for c in R['contact_web'][:1]] + [e(x) for x in R['contact_pdf_extra']] + [link(c) for c in R['contact_web'][1:]])
body = f'<h1>{e(R["name"])}</h1><p class="sub">{e(R["title"])} | {e(R["tagline"])}</p><p class="ct">{contact}</p>'
body += h('Summary')+''.join(f'<p>{e(x)}</p>' for x in R['summary'])
body += h('Skills')+''.join(f'<p class="k"><b>{e(x["label"])}:</b> {e(x["text"])}</p>' for x in R['skills'])
body += h('Tools')+f'<p>{e(R["tools"])}</p>'
body += h('Experience')+f'<p class="co">{e(R["experience_company"])}</p>'
for x in R['experience']:
    body += f'<div class="role"><b>{e(x["role"])}</b><span>{e(x["dates"])} | {e(x["place"])}</span></div>'+(f'<p>{e(x["intro"])}</p>' if x.get('intro') else '')+ul(x['bullets'])
body += h('Education')+''.join(f'<div class="role"><b>{e(x["what"])}</b><span>{e(x["when"])}</span></div><p>{e(x["where"])}</p>' for x in R['education'])
body += h('Portfolio')
for x in R['portfolio']:
    body += f'<div class="role"><b>{e(x["name"])}</b><span>{e(x["meta"])}</span></div><p class="u"><a href="{e(x["url"])}">{e(x["url"].replace("https://",""))}</a></p>'+ul(x['bullets'])
body += h('Certifications')+f'<p>{e(R["certifications"])}</p>'+h('Languages')+f'<p>{e(R["languages"])}</p>'+h('Hobbies')+f'<p>{e(R["hobbies"])}</p>'
css = '''@page{size:A4;margin:13mm 15mm}body{font:9.4pt/1.33 Calibri,Arial,sans-serif;color:#111;margin:0}h1{font-size:21pt;margin:0 0 2pt;letter-spacing:.02em}.sub{font-weight:600;margin:0}.ct{margin:2pt 0 0;font-size:9pt;color:#333}h2{font-size:10pt;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid #999;margin:12pt 0 5pt;padding-bottom:2pt;break-after:avoid}p{margin:3pt 0}ul{margin:3pt 0 0;padding-left:15pt}li{margin:2pt 0}.role{display:flex;justify-content:space-between;gap:12pt;margin-top:8pt;break-after:avoid}.role span{color:#444;white-space:nowrap}.co{font-weight:600}.u{font-size:9pt;color:#444}li,.role{break-inside:avoid}a{color:#0b57b0;text-decoration:underline}'''
html = f'<!doctype html><meta charset="utf-8"><title>Resume {e(R["name"])}</title><style>{css}</style>{body}'
out = SITE / 'assets' / 'Resume_Sameer_Mittimani_PM.pdf'
with tempfile.TemporaryDirectory() as d:
    f = Path(d) / 'r.html'; f.write_text(html, encoding='utf-8')
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge'); pg = b.new_page()
        pg.goto(f.as_uri()); pg.pdf(path=str(out), format='A4', print_background=True, prefer_css_page_size=True); b.close()
shutil.copyfile(out, SITE / 'assets' / 'resume.pdf')
print('PDF written:', out)
