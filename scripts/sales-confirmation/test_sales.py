"""Sales confirmation contract tests on a fresh disposable local database.

Apply platform.sql and ONLY SCKT_FRESH_PROJECT.sql to sckt_sales_fixed first.
This file never disables constraints, RLS or triggers and never contacts a remote DB.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PSQL = ['G:/PostgreSQL/18/bin/psql.exe', '-X', '-h', '127.0.0.1', '-p', '55439',
        '-U', 'postgres', '-d', sys.argv[1] if len(sys.argv) > 1 else 'sckt_sales_fixed', '-v', 'ON_ERROR_STOP=1', '-Atq']
ADMIN = 'a1000000-0000-0000-0000-000000000001'
RESTRICTED = 'a1000000-0000-0000-0000-000000000002'
SALES = 'a1000000-0000-0000-0000-000000000003'
PARTY = 'a2000000-0000-0000-0000-000000000001'
CUSTOMER = 'a2000000-0000-0000-0000-000000000002'
ORDER = 'a3000000-0000-0000-0000-000000000001'
DESIGN = 'a4000000-0000-0000-0000-000000000001'
COST = 'a4000000-0000-0000-0000-000000000002'
results = []
independent_results = []

def run(sql):
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True)

def check(name, sql, expected=None, error=None):
    p = run(sql)
    passed = (p.returncode != 0 and error.lower() in p.stderr.lower()) if error else (p.returncode == 0 and (expected is None or p.stdout.strip() == expected))
    results.append({'test': name, 'pass': passed, 'output': p.stdout.strip(), 'error': p.stderr.strip()})
    print(('PASS ' if passed else 'FAIL ') + name)
    if not passed:
        print(p.stdout, p.stderr)
    return p

def actor(sql, uid=ADMIN, role='authenticated'):
    return f"SET ROLE {role}; SET request.jwt.claim.sub='{uid}'; " + sql

def fingerprint():
    p = run(f"SELECT jsonb_build_object('header', to_jsonb(so),'lines',(SELECT jsonb_agg(to_jsonb(si) ORDER BY si.line_number) FROM public.sales_order_items si WHERE si.order_id=so.id)) FROM public.sales_orders so WHERE so.id='{ORDER}';")
    assert p.returncode == 0, p.stderr
    return hashlib.sha256(p.stdout.encode()).hexdigest()

def unchanged(name, prior):
    results.append({'test':name, 'pass':fingerprint() == prior})

def independent(name, sql, expected=None, error=None):
    # User explicitly requires recording independent defects without repairing them.
    check(name, sql, expected=expected, error=error)
    independent_results.append(results.pop())

check('valid fixtures with all constraints active', f"""
INSERT INTO auth.users(id,email) VALUES ('{ADMIN}','sales-admin@test.invalid'),('{RESTRICTED}','sales-restricted@test.invalid'),('{SALES}','sales-authorized@test.invalid');
INSERT INTO public.role_definitions(role_code,role_name,is_system) VALUES ('sales_test_restricted','Sales test restricted',false),('sales_test_authorized','Sales test authorized',false);
INSERT INTO public.user_roles_mapping(user_id,role_id)
SELECT u.id,rd.id FROM auth.users u JOIN public.role_definitions rd ON rd.role_code=
CASE u.id WHEN '{ADMIN}'::uuid THEN 'admin' WHEN '{SALES}'::uuid THEN 'sales_test_authorized' ELSE 'sales_test_restricted' END;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT rd.id,p.id FROM public.role_definitions rd CROSS JOIN public.permissions p WHERE rd.role_code='sales_test_authorized' AND p.permission_code='sales:update';
INSERT INTO public.parties(id,party_code,party_name,office_name,address_line1,city,state,pin_code)
VALUES ('{PARTY}','TEST-SALES-P','Canonical Customer','Office','Master address','City','State','000000');
INSERT INTO public.customers(id,party_id) VALUES ('{CUSTOMER}','{PARTY}');
INSERT INTO public.designs(id,design_number,design_name) VALUES ('{DESIGN}','DESIGN-CANONICAL','Canonical Design');
INSERT INTO public.cost_sheets(id,sheet_no,sale_rate,status) VALUES ('{COST}','CS-CANONICAL',175,'approved');
INSERT INTO public.sales_orders(id,order_no,customer_id,order_date,delivery_date,subtotal_amount,total_amount,shipping_address,billing_address,broker_name_snapshot)
VALUES ('{ORDER}','TEST-SALES-1','{CUSTOMER}',current_date,current_date+7,2000,2000,'Order shipping address','Order billing address','Order-entered Broker');
INSERT INTO public.sales_order_items(order_id,line_number,fabric_quality_name,qty_metre,qty_reserved,qty_dispatched,rate_per_metre,line_total,design_id,cost_sheet_id)
VALUES ('{ORDER}',1,'Test Quality',10,3,2,170,1700,'{DESIGN}','{COST}');
INSERT INTO public.sales_order_items(order_id,line_number,fabric_quality_name,design_no,qty_metre,rate_per_metre,line_total)
VALUES ('{ORDER}',2,'Unlinked Quality','MANUAL-DESIGN',2,150,300);
""")

before=fingerprint()
check('restricted user denied',actor(f"SELECT * FROM public.confirm_sales_order('{ORDER}','forged');",RESTRICTED),error='Permission denied')
unchanged('restricted attempt has no side effects',before)
check('anonymous denied',actor(f"SELECT * FROM public.confirm_sales_order('{ORDER}','forged');",'', 'anon'),error='permission denied for function')
check('missing uid denied',actor(f"SELECT * FROM public.confirm_sales_order('{ORDER}','forged');",''),error='Authentication required')
unchanged('anonymous and missing uid have no side effects',before)

p=check('canonical Admin confirms real order with lines',actor(f"SELECT row_to_json(r) FROM public.confirm_sales_order('{ORDER}','forged-actor') r;"))
if p.returncode == 0:
    returned=json.loads(p.stdout)
    results.append({'test':'unchanged RPC return contract','pass':set(returned)=={'order_id','status','customer_name_snapshot','broker_name_snapshot','confirmed_at','line_count'} and returned['order_id']==ORDER and returned['line_count']==2 and returned['status']=='CONFIRMED'})
check('header snapshot addresses and authoritative actor',f"SELECT (so.status='CONFIRMED' AND so.confirmed_at IS NOT NULL AND so.updated_by='{ADMIN}' AND so.customer_name_snapshot='Canonical Customer' AND so.broker_name_snapshot='Order-entered Broker' AND so.shipping_address='Order shipping address' AND so.billing_address='Order billing address') FROM public.sales_orders so WHERE so.id='{ORDER}';",'t')
check('linked commercial snapshots use canonical fields',f"SELECT (si.design_no_snapshot='DESIGN-CANONICAL' AND si.design_name_snapshot='Canonical Design' AND si.cost_sheet_no_snapshot='CS-CANONICAL' AND si.approved_sale_rate=175 AND si.approved_by='{ADMIN}' AND si.approved_at=so.confirmed_at) FROM public.sales_order_items si JOIN public.sales_orders so ON so.id=si.order_id WHERE si.order_id='{ORDER}' AND si.line_number=1;",'t')
check('optional design/cost links preserve manual design and agreed rate',f"SELECT (si.design_no_snapshot='MANUAL-DESIGN' AND si.design_name_snapshot IS NULL AND si.cost_sheet_no_snapshot IS NULL AND si.approved_sale_rate=150 AND si.approved_by='{ADMIN}') FROM public.sales_order_items si WHERE si.order_id='{ORDER}' AND si.line_number=2;",'t')
check('canonical quantities unchanged',f"SELECT jsonb_agg(jsonb_build_array(si.qty_metre,si.qty_reserved,si.qty_dispatched) ORDER BY si.line_number) FROM public.sales_order_items si WHERE si.order_id='{ORDER}';",'[[10.00, 3.00, 2.00], [2.00, 0.00, 0.00]]')
check('confirmation creates no reservation or inventory records',"SELECT (SELECT count(*) FROM public.stock_reservations) || ':' || (SELECT count(*) FROM public.inventory_items);",'0:0')

confirmed=fingerprint()
check('already confirmed rejected cleanly',actor(f"SELECT * FROM public.confirm_sales_order('{ORDER}',NULL);"),error='must be DRAFT')
unchanged('repeat confirmation has no duplicate side effects',confirmed)
independent('service follow-up header read visible to canonical role-mapped Admin',actor(f"SELECT count(*) FROM public.sales_orders WHERE id='{ORDER}';"),'1')
independent('confirmed quantity remains immutable for role-mapped Admin',actor(f"BEGIN; UPDATE public.sales_order_items SET qty_metre=11 WHERE order_id='{ORDER}' AND line_number=1; ROLLBACK;"),error='Cannot change ordered quantity')
independent('confirmed pricing remains immutable for role-mapped Admin',actor(f"BEGIN; UPDATE public.sales_order_items SET approved_sale_rate=999 WHERE order_id='{ORDER}' AND line_number=1; ROLLBACK;"),error='Cannot modify approved_sale_rate')
unchanged('independent diagnostics rolled back without side effects',confirmed)
# Verify the pre-existing trigger still rejects changes when its invoker can see
# the parent under the existing legacy policy. Profile setup is transaction-local
# test data only; no policy, trigger or constraint is modified or bypassed.
check('existing immutability trigger with visible parent',f"BEGIN; UPDATE public.profiles SET primary_role_id='admin' WHERE id='{ADMIN}'; "+actor(f"UPDATE public.sales_order_items SET qty_metre=11 WHERE order_id='{ORDER}' AND line_number=1; ROLLBACK;"),error='Cannot change ordered quantity')

check('nonexistent order rejected',actor("SELECT * FROM public.confirm_sales_order('a9990000-0000-0000-0000-000000000001',NULL);"),error='Order not found')
check('missing customer prevented by foreign key',f"INSERT INTO public.sales_orders(order_no,customer_id,order_date,delivery_date,subtotal_amount,total_amount,shipping_address,billing_address) VALUES ('BAD-CUSTOMER','a9990000-0000-0000-0000-000000000001',current_date,current_date,1,1,'S','B');",error='foreign key')

def draft(suffix, status='DRAFT', rate=10, with_line=True):
    oid=f'a5000000-0000-0000-0000-{suffix:012d}'
    sql=f"INSERT INTO public.sales_orders(id,order_no,customer_id,order_date,delivery_date,subtotal_amount,total_amount,shipping_address,billing_address,status) VALUES ('{oid}','TEST-{suffix}','{CUSTOMER}',current_date,current_date,20,20,'S','B','{status}');"
    if with_line:
        sql+=f"INSERT INTO public.sales_order_items(order_id,line_number,fabric_quality_name,qty_metre,rate_per_metre,line_total) VALUES ('{oid}',1,'Test',2,{rate},20);"
    p=run(sql)
    assert p.returncode==0,p.stderr
    return oid

bad=draft(1)
check('blank canonical party name rejected without bypassing constraints',actor(f"SELECT * FROM public.confirm_sales_order('{bad}',NULL);").replace('SET ROLE',f"UPDATE public.parties SET party_name=' ' WHERE id='{PARTY}'; SET ROLE",1),error='no valid party name')
check('invalid customer leaves order draft and lines unapproved',f"SELECT (so.status='DRAFT' AND so.confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.sales_order_items si WHERE si.order_id=so.id AND si.approved_at IS NOT NULL)) FROM public.sales_orders so WHERE so.id='{bad}';",'t')
assert run(f"UPDATE public.parties SET party_name='Canonical Customer' WHERE id='{PARTY}';").returncode==0
empty=draft(2,with_line=False)
check('empty order rejected',actor(f"SELECT * FROM public.confirm_sales_order('{empty}',NULL);"),error='at least one line')
bad_rate=draft(3,rate=0)
check('invalid commercial rate rejected',actor(f"SELECT * FROM public.confirm_sales_order('{bad_rate}',NULL);"),error='invalid quantities or commercial')
for i,status in enumerate(['SHIPPED','CANCELLED'],4):
    oid=draft(i,status)
    check(status+' order rejected',actor(f"SELECT * FROM public.confirm_sales_order('{oid}',NULL);"),error='must be DRAFT')
authorized=draft(6)
check('custom sales:update role allowed without Admin',actor(f"SELECT r.status FROM public.confirm_sales_order('{authorized}','spoof') r;",SALES),'CONFIRMED')

check('confirm RPC ACL',"SELECT has_function_privilege('anon','public.confirm_sales_order(uuid,character varying)','EXECUTE') || ':' || has_function_privilege('authenticated','public.confirm_sales_order(uuid,character varying)','EXECUTE');",'false:true')
check('deprecated RPC authenticated ACL revoked',actor(f"SELECT * FROM public.confirm_sales_order_with_reservation('{bad}',NULL);"),error='permission denied for function')
check('both functions deny PUBLIC execution',"SELECT count(*) FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('confirm_sales_order','confirm_sales_order_with_reservation') AND a.grantee=0 AND a.privilege_type='EXECUTE';",'0')
check('both fixed definer search paths',"SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('confirm_sales_order','confirm_sales_order_with_reservation') AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp'];",'2')
check('deprecated body cannot mutate even for owner',f"SET request.jwt.claim.sub='{ADMIN}'; SELECT * FROM public.confirm_sales_order_with_reservation('{bad}','spoof');",error='is deprecated')

p=run("SELECT json_object_agg(table_name, cols) FROM (SELECT table_name,json_agg(json_build_object('column',column_name,'type',data_type) ORDER BY ordinal_position) cols FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('sales_orders','sales_order_items','customers','parties','stock_reservations') GROUP BY table_name) s;")
assert p.returncode==0,p.stderr
(HERE/'schema-contract.json').write_text(json.dumps(json.loads(p.stdout),indent=2))
(HERE/'database-results.json').write_text(json.dumps(results,indent=2))
(HERE/'independent-findings.json').write_text(json.dumps(independent_results,indent=2))
print(json.dumps({'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results)}))
raise SystemExit(1 if any(not r['pass'] for r in results) else 0)
