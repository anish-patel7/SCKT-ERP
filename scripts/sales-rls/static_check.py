"""Verify only Sales header policies changed in the reviewed bootstrap."""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sql=(ROOT/'supabase/bootstrap/SCKT_FRESH_PROJECT.sql').read_text(encoding='utf-8')
baseline=json.loads((HERE/'baseline.json').read_text())
pattern=re.compile(r'CREATE POLICY\s+(\S+)\s+ON public\.sales_orders\b.*?;',re.S)
policies=list(pattern.finditer(sql))
codes=set(re.findall(r"'((?:sales):[a-z]+)'",'\n'.join(m[0] for m in policies)))
catalog=set(re.findall(r"VALUES \('[^']+', '([^']+:[^']+)'",sql))
masked=re.sub(r'\s+',' ',pattern.sub('',sql))
results={
    'legacy_primary_role_policies':sum('primary_role_id' in m[0] for m in policies),
    'duplicate_header_policies':sum(v-1 for v in Counter(m[1] for m in policies).values() if v>1),
    'unknown_sales_permissions':sorted(codes-catalog),
    'unrelated_sql_changed':hashlib.sha256(masked.encode()).hexdigest()!=baseline['unrelated_sql_normalized_sha256'],
    'frozen_source_migration_config_changes':[f for f,h in baseline['files'].items() if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=h],
}
assert len(policies)==4, 'Expected three business policies and one narrow rollback policy'
for command,permission in [('SELECT','sales:read'),('INSERT','sales:create'),('UPDATE','sales:update')]:
    assert any(f'FOR {command} TO authenticated' in m[0] and permission in m[0] for m in policies)
assert all(not value for value in results.values()),results
(HERE/'static-results.json').write_text(json.dumps({'policy_count':len(policies),'permissions':sorted(codes),**results},indent=2))
print(json.dumps({'policy_count':len(policies),'permissions':sorted(codes),**results},indent=2))
