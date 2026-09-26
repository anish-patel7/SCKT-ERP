"""Run with Python; no remote access or historical migration execution."""
import hashlib
import json
import re
from collections import Counter
from sql_tools import ROOT, BOOTSTRAP, definitions

sql = BOOTSTRAP.read_text(encoding='utf-8')
functions = definitions(sql)
catalog = set(re.findall(r"VALUES \('[^']+', '([^']+:[^']+)'", sql))
used = set(re.findall(r"user_has_permission(?:_v2)?\([^;]*?,\s*'([\w.:]+)'", sql))
policies = re.findall(r'CREATE POLICY\s+(\S+)\s+ON\s+(\S+)', sql)
baseline = json.loads((ROOT/'scripts/bootstrap-security/baseline.json').read_text())
changed = [p for p, h in baseline['files'].items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest() != h]
frontend = set()
for filename in json.loads((ROOT/'scripts/bootstrap-security/reachable-files.json').read_text()):
    frontend.update(re.findall(r'''["']([a-z_.]+:(?:read|write|create|update|delete|approve))["']''', (ROOT/filename).read_text(encoding='utf-8')))
results = {
    'malformed_delimiters': len(re.findall(r'\bAS\s+\$(?!\w*\$)|^\$;', sql, re.M)),
    'policies': len(policies),
    'duplicate_policies': sum(n-1 for n in Counter(policies).values() if n>1),
    'unknown_backend_permissions': sorted(used-catalog),
    'unknown_reachable_frontend_permissions': sorted(frontend-catalog),
    'blanket_client_function_grants': len(re.findall(r'GRANT (?:ALL|EXECUTE) ON (?:ALL )?FUNCTIONS[^;]*TO[^;]*(?:authenticated|anon)', sql)),
    'obsolete_reserved_qty_rpc': sql.count('update_reserved_qty'),
    'destructive_schema_reset': len(re.findall(r'DROP SCHEMA public CASCADE', sql, re.I)),
    'unsafe_definer_search_paths': [sig for sig,m in functions.items() if 'SECURITY DEFINER' in m[3].upper() and 'search_path = public, pg_temp' not in m[3]],
    'spoofable_actor_assignments': re.findall(r'v_current_user\s*:=\s*p_\w+', sql),
    'business_or_historical_source_changes': changed,
    'incorrect_documented_env_name': (ROOT/'FRESH_SUPABASE_SETUP.md').read_text(encoding='utf-8').count('VITE_SUPABASE_ANON_KEY'),
}
print(json.dumps(results, indent=2))
(ROOT/'scripts/bootstrap-security/static-results.json').write_text(json.dumps(results, indent=2))
assert all(not value for key,value in results.items() if key != 'policies'), 'Static validation failed'
