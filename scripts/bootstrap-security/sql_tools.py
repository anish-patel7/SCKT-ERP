"""Focused inspection helpers for the single fresh-project bootstrap."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOTSTRAP = ROOT / 'supabase/bootstrap/SCKT_FRESH_PROJECT.sql'
FUNCTION = re.compile(
    r'CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)\((.*?)\)\s+RETURNS\s+(.*?)\bAS\s+(\$\w*\$)(.*?)\4;',
    re.S | re.I,
)

def signature(match):
    args = re.split(r',\s*(?=\w+\s)', match[2]) if match[2].strip() else []
    return match[1] + '(' + ', '.join(re.split(r'\s+DEFAULT\s+', a.strip(), flags=re.I)[0].split(' ', 1)[1] for a in args) + ')'

def definitions(sql):
    result = {}
    for match in FUNCTION.finditer(sql):
        result[signature(match).lower()] = match
    return result
