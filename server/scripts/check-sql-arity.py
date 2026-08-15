#!/usr/bin/env python3
"""
Cruza cada `client.query(queries.X, [...])` con la aridad real de la query.

Hace falta porque `DatabaseClient.query` recibe `unknown[]`: TypeScript no puede verificar que la
cantidad de parámetros coincida con los `$n` del SQL, así que un desajuste solo aparece en runtime.
Es exactamente el error que se cuela al agregar el filtro de comunidad a ~130 queries.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "api" / "src"

# ── 1. Aridad de cada query ────────────────────────────────────────────────
src = (ROOT / "services/queries.ts").read_text()
# Se parte por cada entrada de primer nivel (`  nombre:`) y se toma todo hasta la siguiente. Es más
# robusto que intentar casar la forma exacta de la llamada: `q(...)` y `q<T>(...)` conviven, y hay
# comentarios en el medio.
starts = [
    (m.group(1), m.start())
    for m in re.finditer(r"^  (\w+):\s*(?:\([^)]*\)\s*=>\s*)?q[<(]", src, re.M)
]
arity = {}
for i, (name, pos) in enumerate(starts):
    end = starts[i + 1][1] if i + 1 < len(starts) else len(src)
    block = src[pos:end]
    # Los comentarios de la entrada SIGUIENTE caen dentro de este bloque, y varios mencionan `$n`
    # al explicar el filtro de comunidad. Hay que sacarlos o inflan la aridad.
    block = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
    block = re.sub(r"^\s*//.*$", "", block, flags=re.M)
    nums = [int(x) for x in re.findall(r"\$(\d+)", block)]
    arity[name] = max(nums) if nums else 0

# ── 2. Call sites ──────────────────────────────────────────────────────────
def split_args(s):
    """
    Cuenta elementos top-level de un array literal, respetando anidamiento y descartando la
    trailing comma que deja Prettier.
    """
    depth, segments, cur = 0, [], ""
    for ch in s:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            segments.append(cur)
            cur = ""
            continue
        cur += ch
    segments.append(cur)
    return len([seg for seg in segments if seg.strip()])

def balanced_array(text, start):
    """
    Devuelve el array literal que empieza en `start` (que debe apuntar a un `[`), emparejando
    corchetes. Hace falta porque los argumentos suelen contener índices anidados —
    `key.split("-")[n]`— y un regex no-greedy cortaría en el corchete equivocado.
    """
    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch in "[({":
            depth += 1
        elif ch in "])}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


# Solo localiza el comienzo de la llamada; el array se extrae emparejando corchetes.
call = re.compile(r"\.query\(\s*queries\.(\w+)\s*(\([^)]*\))?\s*,\s*(?=\[)", re.S)
call_no_args = re.compile(r"\.query\(\s*queries\.(\w+)\s*(\([^)]*\))?\s*\)", re.S)
problems, checked = [], 0

for path in sorted(ROOT.rglob("*.ts")):
    if path.name.endswith(".test.ts") or path.name == "queries.ts":
        continue
    text = path.read_text()
    seen = set()

    for m in call.finditer(text):
        name = m.group(1)
        seen.add(m.start())
        args = balanced_array(text, m.end())
        loc = f"{path.relative_to(ROOT.parent.parent)}:{text[: m.start()].count(chr(10)) + 1}"
        if name not in arity:
            problems.append((loc, name, "?", "query desconocida"))
            continue
        if args is None:
            problems.append((loc, name, arity[name], "no se pudo leer el array"))
            continue
        # Un spread (...ids) hace que el conteo estático no signifique nada.
        if "..." in args:
            continue
        # Los comentarios dentro del array tienen comas y romperían el conteo.
        clean = re.sub(r"^\s*//.*$", "", args[1:-1], flags=re.M)
        got = split_args(clean)
        checked += 1
        if got != arity[name]:
            problems.append((loc, name, arity[name], got))

    # Llamadas sin array de parámetros: la query no debe usar ningún $n.
    for m in call_no_args.finditer(text):
        if m.start() in seen:
            continue
        name = m.group(1)
        if name not in arity:
            continue
        checked += 1
        if arity[name] != 0:
            loc = f"{path.relative_to(ROOT.parent.parent)}:{text[: m.start()].count(chr(10)) + 1}"
            problems.append((loc, name, arity[name], 0))

print(f"Call sites verificados: {checked}\n")
if problems:
    print(f"!! {len(problems)} DESAJUSTES DE ARIDAD:\n")
    for loc, name, exp, got in problems:
        print(f"  {loc}\n      queries.{name}: la query usa ${exp}, el call site pasa {got}\n")
    sys.exit(1)
print("OK: todos los call sites coinciden con la aridad de su query.")

