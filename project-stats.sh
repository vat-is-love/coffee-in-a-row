#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
python3 - <<'PY'
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

languages = {
    ".ts": "TypeScript", ".js": "JavaScript", ".mjs": "JavaScript",
    ".java": "Java", ".css": "CSS", ".html": "HTML",
    ".py": "Python", ".svg": "SVG", ".sh": "Bash",
}
config_extensions = {".json", ".yml", ".yaml", ".gradle", ".properties", ".webmanifest"}
config_files = {
    ".env.example", ".gitignore", ".prettierrc", "eslint.config.js",
    "playwright.config.ts", "vite.config.ts", "vitest.config.ts",
    "android/app/src/main/AndroidManifest.xml",
}
test_sections = {"test", "tests", "__tests__"}
application = "Приложение, скрипты и конфигурация"
tests = "Тесты"
documentation = "Документация"
sections = (application, tests, documentation)

stats = {section: defaultdict(Counter) for section in sections}
excluded = Counter()


def group_html_lines(lines):
    groups = {"HTML": []}
    embedded = None
    for line in lines:
        if embedded and not re.search(rf"</{embedded}\s*>", line, re.IGNORECASE):
            category = "JavaScript" if embedded == "script" else "CSS"
            groups.setdefault(category, []).append(line)
            continue

        groups["HTML"].append(line)
        opening = re.match(r"\s*<(script|style)\b", line, re.IGNORECASE)
        embedded = None
        if opening and not re.search(rf"</{opening[1]}\s*>", line, re.IGNORECASE):
            embedded = opening[1].lower()
    return groups


def classify_lines(path, suffix, file_type, lines):
    category = languages.get(suffix, f"Прочее ({file_type})")
    if suffix in {".md", ".markdown", ".rst", ".adoc"} or path.parts[0] == "docs":
        category = "Markdown" if suffix in {".md", ".markdown"} else category
        return documentation, {category: lines}
    if (
        test_sections.intersection(path.parts[:-1])
        or re.search(r"\.(test|spec)\.", path.name)
        or path.as_posix() == "scripts/check-service-worker.mjs"
    ):
        return tests, {category: lines}
    if suffix in config_extensions or path.as_posix() in config_files:
        return application, {"Конфигурация": lines}
    if suffix == ".html":
        return application, group_html_lines(lines)
    return application, {category: lines}


paths = subprocess.check_output(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"]
).split(b"\0")

for raw_path in sorted(set(paths) - {b""}):
    path = Path(raw_path.decode(errors="surrogateescape"))
    if path.is_symlink() or not path.is_file():
        continue
    suffix = path.suffix.lower()
    file_type = suffix or "без расширения"
    if path.as_posix() == "package-lock.json":
        file_type = path.name

    content = None
    if file_type not in {".png", ".zip", "package-lock.json"}:
        try:
            content = path.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            pass
    if content is None or "\0" in content:
        excluded[file_type] += 1
        continue

    section, groups = classify_lines(path, suffix, file_type, content.splitlines())
    for category, group in groups.items():
        stats[section][category].update(
            lines=len(group), nonblank=sum(bool(line.strip()) for line in group)
        )

width = max(36, *(len(category) for rows in stats.values() for category in rows))
print(f"{'Категория':<{width}}  {'Всего':>8}  {'Непустых':>8}")


def print_row(label, counts):
    print(f"{label:<{width}}  {counts['lines']:>8}  {counts['nonblank']:>8}")


total = Counter()
for section, categories in stats.items():
    subtotal = Counter()
    print(f"\n{section}")
    for category, counts in sorted(categories.items()):
        print_row(f"  {category}", counts)
        subtotal.update(counts)
    print_row("Подытог", subtotal)
    total.update(subtotal)
print()
print_row("Весь проект", total)
if excluded:
    details = ", ".join(f"{name} ({count})" for name, count in sorted(excluded.items()))
    print(f"\nИсключённые файлы: {details}")
PY
