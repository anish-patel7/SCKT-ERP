"""Additional local-only ACL, mutation denial and valid Sales smoke checks."""
import json
import re
import subprocess
from sql_tools import ROOT, BOOTSTRAP, definitions, signature

PSQL=['G:/PostgreSQL/18/bin/psql.exe','-X','-h','127.0.0.1','-p','55439','-U','postgres','-d','sckt_final','-v','ON_ERROR_STOP=1','-At']
def run(sql):
    return subprocess.run(PSQL,input=sql,text=True,capture_output=True)

sql=BOOTSTRAP.read_text(encoding='utf-8')
results=[]
for sig,m in definitions(sql).items():
    if not re.search(r'GRANT EXECUTE ON FUNCTION public\.'+re.escape(signature(m))+r' TO authenticated;',sql):continue
    if m[1].startswith('get_') or m[1] in {'has_role','is_admin','user_has_permission','user_has_permission_v2'}:continue
    types=sig[sig.index('(')+1:-1].split(', ')
    call=f"SELECT public.{m[1]}("+', '.join('NULL::'+t for t in types)+');'
    p=run("SET ROLE authenticated; SET request.jwt.claim.sub=''; "+call)
    denied=p.returncode!=0 and any(x in p.stderr.lower() for x in ['authentication','not authenticated','permission']) or '(f,' in p.stdout and any(x in p.stdout.lower() for x in ['authentication','permission'])
    results.append({'test':'missing auth uid: '+m[1],'pass':denied,'error':p.stderr.strip(),'output':p.stdout.strip()})

checks={
'all business tables deny anon SQL privileges': "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v') AND (has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('anon',oid,'INSERT') OR has_table_privilege('anon',oid,'UPDATE') OR has_table_privilege('anon',oid,'DELETE'));",
'all definers have fixed safe search path': "SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef AND NOT COALESCE(proconfig @> ARRAY['search_path=public, pg_temp'],false);",
'anon function ACL exposure': "SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege('anon',oid,'EXECUTE');",
'PUBLIC function ACL exposure': "SELECT count(*) FROM pg_proc p, LATERAL aclexplode(COALESCE(proacl,acldefault('f',proowner))) a WHERE pronamespace='public'::regnamespace AND grantee=0 AND privilege_type='EXECUTE';",
}
for name,query in checks.items():
    p=run(query);results.append({'test':name,'pass':p.returncode==0 and p.stdout.strip()=='0','output':p.stdout.strip(),'error':p.stderr.strip()})

p=run("""
BEGIN;
INSERT INTO public.parties(id,party_code,party_name,office_name,address_line1,city,state,pin_code)
VALUES ('40000000-0000-0000-0000-000000000001','sales-test','Sales test','Test','Test','Test','Test','000000');
INSERT INTO public.customers(id,party_id) VALUES ('40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001');
INSERT INTO public.sales_orders(id,order_no,customer_id,order_date,delivery_date,subtotal_amount,total_amount,shipping_address,billing_address)
VALUES ('40000000-0000-0000-0000-000000000003','test-confirm','40000000-0000-0000-0000-000000000002',current_date,current_date,0,0,'Test','Test');
SET ROLE authenticated;
SET request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
SELECT * FROM public.confirm_sales_order('40000000-0000-0000-0000-000000000003','spoof');
ROLLBACK;
""")
results.append({'test':'Admin valid Sales confirmation','pass':p.returncode==0,'output':p.stdout.strip(),'error':p.stderr.strip()})
out=ROOT/'scripts/bootstrap-security/additional-results.json'
out.write_text(json.dumps(results,indent=2))
for r in results:print(('PASS ' if r['pass'] else 'FAIL ')+r['test']+(' '+r['error'] if not r['pass'] else ''))
