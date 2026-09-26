"""Verify that the repair is restricted to the two Sales confirmation RPCs."""
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / 'bootstrap-security'))
from sql_tools import BOOTSTRAP, FUNCTION, definitions

sql = BOOTSTRAP.read_text(encoding='utf-8')
baseline = json.loads((HERE / 'baseline.json').read_text())
names = {'confirm_sales_order', 'confirm_sales_order_with_reservation'}
functions = [m for m in definitions(sql).values() if m[1] in names]
body = '\n'.join(m[5] for m in functions)
masked = FUNCTION.sub(lambda m: '-- SALES CONFIRMATION FUNCTION' if m[1] in names else m[0], sql)
masked = re.sub(r'^GRANT EXECUTE ON FUNCTION public.confirm_sales_order_with_reservation\([^;]+;\n', '', masked, flags=re.M)
results = {
    'ambiguous_select_status': len(re.findall(r'\bSELECT\s+status\b', body, re.I)),
    'stale_party_name': len(re.findall(r'\b(?:parties|p)\.name\b', body)),
    'invalid_broker_party_id': body.count('broker_party_id'),
    'ordered_quantity': body.count('ordered_quantity'),
    'reserved_quantity': body.count('reserved_quantity'),
    'dispatched_quantity': body.count('dispatched_quantity'),
    'deprecated_authenticated_grants': len(re.findall(r'^GRANT .*confirm_sales_order_with_reservation[^;]*TO authenticated', sql, re.M)),
    'unrelated_sql_changed': hashlib.sha256(masked.encode()).hexdigest() != baseline['unrelated_sql_sha256'],
    'frozen_files_changed': [f for f,h in baseline['files'].items() if hashlib.sha256((ROOT/f).read_bytes()).hexdigest() != h],
    'unsafe_search_path': [m[1] for m in functions if 'SET search_path = public, pg_temp' not in m[3]],
}
(HERE/'static-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
assert all(not value for value in results.values())
