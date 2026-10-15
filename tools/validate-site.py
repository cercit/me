"""Check the portfolio's files, links and local preview without changing the site."""

import sys

sys.dont_write_bytecode = True

import argparse
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import Request, urlopen


WORKSPACE = Path(__file__).resolve().parent
SITE = WORKSPACE.parent
REPORT = WORKSPACE / "static-test-results.json"
CSS_URL = re.compile(r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^)]*?))\s*\)", re.IGNORECASE)


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = []
        self.id_lines = {}
        self.h1_count = 0
        self.in_h1 = False
        self.h1_parts = []
        self.text_parts = []
        self.base_href = None
        self.lang = ""
        self.title_count = 0
        self.title_parts = []
        self.in_title = False
        self.descriptions = []
        self.references = []
        self.styles = []
        self.in_style = False
        self.style_line = 0
        self.style_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        line = self.getpos()[0]
        element_id = attributes.get("id")
        if element_id is not None:
            self.ids.append(element_id)
            self.id_lines.setdefault(element_id, []).append(line)
        if tag == "html":
            self.lang = attributes.get("lang") or ""
        elif tag == "h1":
            self.h1_count += 1
            self.in_h1 = True
        elif tag == "base" and self.base_href is None:
            self.base_href = attributes.get("href")
        elif tag == "title":
            self.title_count += 1
            self.in_title = True
        elif tag == "meta" and (attributes.get("name") or "").lower() == "description":
            self.descriptions.append(attributes.get("content") or "")
        elif tag == "style":
            self.in_style = True
            self.style_line = line
            self.style_parts = []

        for attribute in ("href", "src", "poster"):
            if attribute in attributes:
                self.references.append((attributes[attribute] or "", line, f"{tag}[{attribute}]"))

        if tag == "object" and "data" in attributes:
            self.references.append((attributes["data"] or "", line, "object[data]"))
        if tag in ("img", "source") and attributes.get("srcset"):
            # Data URLs contain commas and already have all their data inline.
            if not attributes["srcset"].lstrip().startswith("data:"):
                for candidate in attributes["srcset"].split(","):
                    parts = candidate.strip().split()
                    if parts:
                        self.references.append((parts[0], line, f"{tag}[srcset]"))
        if attributes.get("style"):
            self.styles.append((attributes["style"], line))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag == "style":
            self.in_style = False
            self.styles.append(("".join(self.style_parts), self.style_line))

    def handle_data(self, data):
        self.text_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)
        if self.in_title:
            self.title_parts.append(data)
        if self.in_style:
            self.style_parts.append(data)


def relative(path):
    return path.relative_to(SITE).as_posix()


def issue(failures, path, line, check, detail):
    failures.append({"file": relative(path), "line": line, "check": check, "detail": detail})


def local_target(source, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        return None, ""
    decoded_path = unquote(parts.path)
    if decoded_path == "/me" or decoded_path.startswith("/me/"):
        decoded_path = decoded_path[3:] or "/"  # GitHub Pages serves this repo under /me/
    if decoded_path.startswith("/"):
        target = SITE / decoded_path.lstrip("/")
    elif decoded_path:
        target = source.parent / decoded_path
    else:
        target = source
    target = target.resolve()
    target.relative_to(SITE.resolve())
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(parts.fragment)


def check_reference(source, url, line, context, documents, assets, failures):
    url = url.strip()
    if not url or url == "#":
        issue(failures, source, line, "empty_reference", f"{context} has an empty destination: {url!r}.")
        return
    try:
        parts = urlsplit(url)
    except ValueError as error:
        issue(failures, source, line, "invalid_url", f"{context}: {error}")
        return
    if parts.scheme.lower() in {"javascript", "vbscript"}:
        issue(failures, source, line, "dead_link", f"{context} uses {parts.scheme}: instead of a destination.")
        return
    if parts.scheme or parts.netloc:
        return
    try:
        target, fragment = local_target(source, url)
    except ValueError:
        issue(failures, source, line, "outside_site", f"{context} points outside the site: {url}")
        return
    if not target.is_file():
        issue(failures, source, line, "missing_file", f"{context}: {url} resolves to missing {relative(target)}.")
        return
    assets.add(target)
    if fragment and target.suffix.lower() in {".html", ".htm"}:
        document = documents.get(target)
        if document is None:
            issue(failures, source, line, "unparsed_html", f"Cannot inspect the fragment in {url}.")
        elif fragment not in document.ids:
            issue(failures, source, line, "missing_fragment", f"{context}: {url} has no element with id={fragment!r}.")


def css_references(source, css, start_line, documents, assets, failures):
    css = re.sub(r"/\*.*?\*/", lambda match: "\n" * match.group(0).count("\n"), css, flags=re.DOTALL)
    for match in CSS_URL.finditer(css):
        url = next((part for part in match.groups() if part is not None), "").strip()
        # Fragment-only SVG references refer to the rendered document, not a CSS file.
        if url.startswith("#"):
            continue
        line = start_line + css[:match.start()].count("\n")
        check_reference(source, url, line, "CSS url()", documents, assets, failures)


def fetch(base_url, route, method="GET"):
    request = Request(base_url.rstrip("/") + route, method=method, headers={"User-Agent": "Portfolio-local-check/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            return response.status, response.read() if method == "GET" else b"", None
    except HTTPError as error:
        return error.code, error.read() if method == "GET" else b"", None
    except (URLError, OSError) as error:
        return None, b"", str(error)


def normalize_text(parts):
    return " ".join(" ".join(parts).split())


def check_404_links(base_url, route, document, documents):
    page_url = base_url.rstrip("/") + route
    base_address = urljoin(page_url, document.base_href) if document.base_href else page_url
    expected_origin = urlsplit(base_url)
    parsed_base = urlsplit(base_address)
    if (parsed_base.scheme, parsed_base.netloc) != (expected_origin.scheme, expected_origin.netloc):
        return [{"route": base_address, "passed": False, "error": "The 404 base URL points outside the local preview."}]

    checks = []
    seen = set()
    for reference, line, context in document.references:
        raw_url = urlsplit(reference)
        if raw_url.scheme or raw_url.netloc:
            continue
        resolved = urlsplit(urljoin(base_address, reference))
        local_route = resolved.path or "/"
        if resolved.query:
            local_route += "?" + resolved.query
        key = (local_route, resolved.fragment)
        if key in seen:
            continue
        seen.add(key)
        status, _, error = fetch(base_url, local_route, method="HEAD")
        fragment_found = None
        if resolved.fragment:
            try:
                target, fragment = local_target(SITE / "404.html", resolved.path + "#" + resolved.fragment)
                target_document = documents.get(target)
                fragment_found = target_document is not None and fragment in target_document.ids
            except ValueError:
                fragment_found = False
        checks.append({
            "source_reference": reference,
            "route": local_route,
            "fragment": resolved.fragment or None,
            "fragment_found": fragment_found,
            "status": status,
            "passed": status == 200 and fragment_found is not False,
            "error": error,
            "line": line,
            "context": context
        })
    return checks


def run_checks(base_url):
    failures = []
    documents = {}
    assets = set()
    html_files = sorted(SITE.rglob("*.html"))

    if not (SITE / "index.html").is_file():
        failures.append({"file": "index.html", "line": 1, "check": "missing_entry", "detail": "The index.html entry page has not been generated."})

    for path in html_files:
        document = Document(path.resolve())
        try:
            document.feed(path.read_text(encoding="utf-8"))
            document.close()
            documents[path.resolve()] = document
        except (OSError, UnicodeError) as error:
            issue(failures, path, 1, "parse_error", str(error))
            continue

        for element_id, count in Counter(document.ids).items():
            if not element_id:
                issue(failures, path, document.id_lines[element_id][0], "empty_id", "An element has an empty id.")
            elif count > 1:
                issue(failures, path, document.id_lines[element_id][0], "duplicate_id", f"id={element_id!r} occurs {count} times on lines {document.id_lines[element_id]}.")
        if document.h1_count != 1:
            issue(failures, path, 1, "h1_count", f"Expected one h1; found {document.h1_count}.")
        if not document.lang.strip():
            issue(failures, path, 1, "missing_lang", "The html element needs a lang attribute.")
        if document.title_count != 1 or not "".join(document.title_parts).strip():
            issue(failures, path, 1, "page_title", "Expected one nonempty title element.")
        if len(document.descriptions) != 1 or not document.descriptions[0].strip():
            issue(failures, path, 1, "page_description", "Expected one nonempty meta description.")

    for document in documents.values():
        for url, line, context in document.references:
            check_reference(document.path, url, line, context, documents, assets, failures)
        for css, line in document.styles:
            css_references(document.path, css, line, documents, assets, failures)

    css_files = sorted(SITE.rglob("*.css"))
    for path in css_files:
        try:
            css_references(path.resolve(), path.read_text(encoding="utf-8"), 1, documents, assets, failures)
        except (OSError, UnicodeError) as error:
            issue(failures, path, 1, "css_read_error", str(error))

    routes = {"/"}
    for path in html_files:
        route = "/" + quote(relative(path), safe="/")
        routes.add(route)
        if path.name == "index.html":
            directory_route = "/" + quote(path.parent.relative_to(SITE).as_posix(), safe="/").strip(".")
            routes.add(directory_route.rstrip("/") + "/")

    http_checks = []
    for route in sorted(routes):
        status, _, error = fetch(base_url, route)
        passed = status == 200
        http_checks.append({"route": route, "expected_status": 200, "status": status, "passed": passed, "error": error})
        if not passed:
            failures.append({"file": "local server", "line": None, "check": "route_status", "detail": f"{route}: expected HTTP 200; got {status}. {error or ''}".strip()})

    for path in sorted(assets):
        if path.suffix.lower() in {".html", ".htm"}:
            continue
        route = "/" + quote(relative(path), safe="/")
        status, _, error = fetch(base_url, route, method="HEAD")
        passed = status == 200
        http_checks.append({"route": route, "expected_status": 200, "status": status, "passed": passed, "error": error})
        if not passed:
            failures.append({"file": relative(path), "line": None, "check": "asset_status", "detail": f"{route}: expected HTTP 200; got {status}. {error or ''}".strip()})

    custom404_path = SITE / "404.html"
    expected404 = documents.get(custom404_path.resolve())
    if expected404 is None:
        failures.append({"file": "404.html", "line": 1, "check": "missing_custom404", "detail": "The custom 404 page is missing."})

    blocked_routes = ["/this-page-does-not-exist", "/missing/nested/page.html", "/SESSION.md", "/../SESSION.md", "/%2e%2e/SESSION.md", "/portfolio-audit.md", "/static-test-results.json"]
    security_checks = []
    for route in blocked_routes:
        status, body, error = fetch(base_url, route)
        served404 = Document(custom404_path)
        try:
            served404.feed(body.decode("utf-8"))
            served404.close()
        except (UnicodeError, ValueError) as parse_error:
            error = str(parse_error)
        heading_matches = expected404 is not None and served404.h1_count == 1 and normalize_text(served404.h1_parts) == normalize_text(expected404.h1_parts)
        expected_content = normalize_text(expected404.text_parts) if expected404 is not None else ""
        content_present = bool(expected_content) and expected_content in normalize_text(served404.text_parts)
        link_checks = check_404_links(base_url, route, served404, documents) if heading_matches and content_present else []
        links_passed = bool(link_checks) and all(check["passed"] for check in link_checks)
        passed = status == 404 and heading_matches and content_present and links_passed
        security_checks.append({
            "route": route,
            "expected_status": 404,
            "status": status,
            "expected_heading": heading_matches,
            "expected_content": content_present,
            "base_href": served404.base_href,
            "resolved_references": link_checks,
            "passed": passed,
            "error": error
        })
        if not passed:
            failures.append({"file": "local server", "line": None, "check": "private_file_or_404", "detail": f"{route}: expected HTTP 404 with the site's heading, content and working references; got status={status}, heading_matches={heading_matches}, content_present={content_present}, links_passed={links_passed}. {error or ''}".strip()})
            for link_check in link_checks:
                if not link_check["passed"]:
                    failures.append({"file": "served 404", "line": link_check.get("line"), "check": "404_reference", "detail": f"{route}: {link_check.get('source_reference')} resolves to {link_check['route']}, status={link_check.get('status')}, fragment_found={link_check.get('fragment_found')}."})

    report = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "site_directory": str(SITE),
        "base_url": base_url,
        "passed": not failures,
        "summary": {"html_pages": len(html_files), "css_files": len(css_files), "referenced_local_files": len(assets), "http_checks": len(http_checks), "security_checks": len(security_checks), "failures": len(failures)},
        "failures": failures,
        "http_checks": http_checks,
        "security_checks": security_checks,
        "scope": "Local HTML metadata, unique IDs, headings, references, fragments, CSS URLs, served routes and preview file boundaries. External links and forms are not tested."
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"]))
    for failure in failures[:40]:
        line_label = f":{failure['line']}" if failure["line"] else ""
        print(f"FAIL {failure['file']}{line_label} [{failure['check']}]: {failure['detail']}")
    print(f"Report: {REPORT}")
    return 0 if report["passed"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:4173")
    parser.add_argument("--wait", type=float, default=0, help="Wait up to this many seconds for index.html.")
    arguments = parser.parse_args()
    deadline = time.monotonic() + max(0, arguments.wait)
    while not (SITE / "index.html").is_file() and time.monotonic() < deadline:
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    return run_checks(arguments.base_url)


if __name__ == "__main__":
    raise SystemExit(main())
