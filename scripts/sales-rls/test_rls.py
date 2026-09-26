"""Local database-role regression tests for Sales header RLS.

Run once after applying the platform fixture and ONLY the bootstrap to a clean DB.
All business writes below run as authenticated/anon unless explicitly fixture setup.
No RLS/constraint/trigger disabling and no remote connections.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
PSQL=['G:/PostgreSQL/18/bin/psql.exe','-X','-h','127.0.0.1','-p','55439','-U','postgres',
      '-d',sys.argv[1] if len(sys.argv)>1 else 'sckt_rls_fixed','-v','ON_ERROR_STOP=1','-Atq']
ADMIN='b1000000-0000-0000-0000-000000000001'
CUSTOM='b1000000-0000-0000-0000-000000000002'
NONE='b1000000-0000-0000-0000-000000000003'
CUSTOMER='b2000000-0000-0000-0000-000000000001'
emails={ADMIN:'rls-admin@test.invalid',CUSTOM:'rls-custom@test.invalid',NONE:'rls-none@test.invalid'}
results=[]

def run(sql):return subprocess.run(PSQL,input=sql,text=True,capture_output=True)
def check(name,sql,expected=None,error=None):
    p=run(sql)
    passed=(p.returncode!=0 and error.lower() in p.stderr.lower()) if error else (p.returncode==0 and (expected is None or p.stdout.strip()==expected))
    results.append({'test':name,'pass':passed,'output':p.stdout.strip(),'error':p.stderr.strip()})
    print(('PASS ' if passed else 'FAIL ')+name)
    if not passed: print(p.stdout,p.stderr)
    return p
def actor(uid,sql,role='authenticated'):
    claims=json.dumps({'sub':uid,'email':emails.get(uid,'')})
    return f"SET ROLE {role}; SET request.jwt.claim.sub='{uid}'; SET request.jwt.claims='{claims}'; "+sql
def oid(n):return f'b3000000-0000-0000-0000-{n:012d}'
def header(n,uid,status='DRAFT',by_uuid=False,confirmed=False):
    creator=uid if by_uuid else emails[uid]
    return f"INSERT INTO public.sales_orders(id,order_no,customer_id,order_date,delivery_date,subtotal_amount,total_amount,shipping_address,billing_address,status,created_by,confirmed_at) VALUES ('{oid(n)}','RLS-{n}','{CUSTOMER}',current_date,current_date+7,100,100,'Ship','Bill','{status}','{creator}',{'now()' if confirmed else 'NULL'}) RETURNING id;"
def line(n,qty=10):
    return f"INSERT INTO public.sales_order_items(order_id,line_number,fabric_quality_name,qty_metre,rate_per_metre,line_total) VALUES ('{oid(n)}',1,'Quality',{qty},10,100) RETURNING order_id;"
def change(n,sql):return f"WITH changed AS ({sql} RETURNING id) SELECT count(*) FROM changed;"
def delete(n):return change(n,f"DELETE FROM public.sales_orders WHERE id='{oid(n)}'")
def fetch(n):
    # Same header filter and related rows used by service getOrderById().
    return f"SELECT so.status || ':' || (SELECT count(*) FROM public.sales_order_items si WHERE si.order_id=so.id) FROM public.sales_orders so WHERE so.id='{oid(n)}';"

check('fixture: canonical mappings and current permission catalog',f"""
INSERT INTO auth.users(id,email) VALUES ('{ADMIN}','{emails[ADMIN]}'),('{CUSTOM}','{emails[CUSTOM]}'),('{NONE}','{emails[NONE]}');
INSERT INTO public.role_definitions(role_code,role_name,is_system) VALUES ('rls_custom','RLS custom',false),('rls_none','RLS none',false);
INSERT INTO public.user_roles_mapping(user_id,role_id)
SELECT u.id,rd.id FROM auth.users u JOIN public.role_definitions rd ON rd.role_code=CASE u.id WHEN '{ADMIN}'::uuid THEN 'admin' WHEN '{CUSTOM}'::uuid THEN 'rls_custom' ELSE 'rls_none' END;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT rd.id,p.id FROM public.role_definitions rd CROSS JOIN public.permissions p WHERE rd.role_code='rls_custom' AND p.permission_code IN ('sales:read','sales:create','sales:update');
INSERT INTO public.parties(id,party_code,party_name,office_name,address_line1,city,state,pin_code)
VALUES ('b2000000-0000-0000-0000-000000000002','RLS-P','RLS Customer','Office','Address','City','State','000000');
INSERT INTO public.customers(id,party_id) VALUES ('{CUSTOMER}','b2000000-0000-0000-0000-000000000002');
""")
check('Admin has canonical mapping and no legacy Admin profile',f"SELECT (public.is_admin('{ADMIN}') AND EXISTS(SELECT 1 FROM public.user_roles_mapping m JOIN public.role_definitions rd ON rd.id=m.role_id WHERE m.user_id='{ADMIN}' AND rd.role_code='admin') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id='{ADMIN}' AND p.primary_role_id IS DISTINCT FROM 'admin'))",'t')

for uid,n,label in [(ADMIN,1,'Admin'),(CUSTOM,2,'Custom Sales')]:
    check(label+' create header with returned row',actor(uid,header(n,uid)),oid(n))
    check(label+' create line with returned row',actor(uid,line(n)),oid(n))
    check(label+' list/read header and line',actor(uid,fetch(n)),'DRAFT:1')
    check(label+' update Draft',actor(uid,change(n,f"UPDATE public.sales_orders SET remarks='draft edited' WHERE id='{oid(n)}'")),'1')
    check(label+' confirm RPC',actor(uid,f"SELECT r.status FROM public.confirm_sales_order('{oid(n)}','spoof') r;"),'CONFIRMED')
    check(label+' immediate post-confirm fetch with lines',actor(uid,fetch(n)),'CONFIRMED:1')
    check(label+' authoritative actor and customer snapshot',actor(uid,f"SELECT (so.updated_by='{uid}' AND so.confirmed_at IS NOT NULL AND so.customer_name_snapshot='RLS Customer') FROM public.sales_orders so WHERE so.id='{oid(n)}';"),'t')
    check(label+' confirmed header mutation denied',actor(uid,f"UPDATE public.sales_orders SET customer_name_snapshot='tampered' WHERE id='{oid(n)}';"),error='Cannot modify customer_name_snapshot')
    check(label+' confirmed line quantity denied',actor(uid,f"UPDATE public.sales_order_items SET qty_metre=11 WHERE order_id='{oid(n)}';"),error='Cannot change ordered quantity')
    check(label+' confirmed commercial rate denied',actor(uid,f"UPDATE public.sales_order_items SET approved_sale_rate=999 WHERE order_id='{oid(n)}';"),error='Cannot modify approved_sale_rate')
    check(label+' protected state unchanged',actor(uid,f"SELECT (so.customer_name_snapshot='RLS Customer' AND si.qty_metre=10 AND si.approved_sale_rate=10) FROM public.sales_orders so JOIN public.sales_order_items si ON si.order_id=so.id WHERE so.id='{oid(n)}';"),'t')

check('unauthorized header read returns no rows',actor(NONE,'SELECT count(*) FROM public.sales_orders;'),'0')
check('unauthorized line read returns no rows',actor(NONE,'SELECT count(*) FROM public.sales_order_items;'),'0')
check('unauthorized insert denied',actor(NONE,header(3,NONE)),error='row-level security')
check('unauthorized update affects no rows',actor(NONE,change(1,f"UPDATE public.sales_orders SET remarks='unauthorized' WHERE id='{oid(1)}'")),'0')
check('unauthorized line insert denied',actor(NONE,line(1)),error='row-level security')
check('unauthorized line update affects no rows',actor(NONE,change(1,f"UPDATE public.sales_order_items SET remarks='unauthorized' WHERE order_id='{oid(1)}'")),'0')
check('unauthorized direct confirmation denied',actor(NONE,f"SELECT * FROM public.confirm_sales_order('{oid(1)}',NULL);"),error='Permission denied')
for name,sql in [('read','SELECT * FROM public.sales_orders;'),('insert',header(4,ADMIN)),('update',f"UPDATE public.sales_orders SET remarks='anon' WHERE id='{oid(1)}';"),('confirm',f"SELECT * FROM public.confirm_sales_order('{oid(1)}',NULL);")]:
    check('anon '+name+' denied',actor('',sql,'anon'),error='permission denied')

check('custom creates second draft before permission removal',actor(CUSTOM,header(5,CUSTOM)),oid(5))
check('custom creates line before permission removal',actor(CUSTOM,line(5)),oid(5))
check('remove custom sales:update',"DELETE FROM public.role_permissions rp USING public.role_definitions rd,public.permissions p WHERE rp.role_id=rd.id AND rp.permission_id=p.id AND rd.role_code='rls_custom' AND p.permission_code='sales:update';")
check('custom retains read after update removal',actor(CUSTOM,fetch(5)),'DRAFT:1')
check('custom header update denied after removal',actor(CUSTOM,change(5,f"UPDATE public.sales_orders SET remarks='removed permission' WHERE id='{oid(5)}'")),'0')
check('custom line update denied after removal',actor(CUSTOM,change(5,f"UPDATE public.sales_order_items SET rate_per_metre=20 WHERE order_id='{oid(5)}'")),'0')
check('custom RPC denied after removal',actor(CUSTOM,f"SELECT * FROM public.confirm_sales_order('{oid(5)}',NULL);"),error='Permission denied')
check('permission removal leaves Draft unchanged',actor(CUSTOM,f"SELECT (so.status='DRAFT' AND so.confirmed_at IS NULL AND so.remarks IS NULL AND si.rate_per_metre=10 AND si.approved_at IS NULL) FROM public.sales_orders so JOIN public.sales_order_items si ON si.order_id=so.id WHERE so.id='{oid(5)}';"),'t')

# Actual service rollback: header insert succeeds, line statement fails, DELETE.
for n,status,uuid_creator in [(6,'DRAFT',False),(7,'CONFIRMED',False),(8,'DRAFT',True)]:
    check('rollback fixture '+str(n),actor(CUSTOM,header(n,CUSTOM,status,uuid_creator)),oid(n))
    check('line failure before rollback '+str(n),actor(CUSTOM,line(n,qty=0)),error='check constraint')
    check('creator empty header rollback '+str(n),actor(CUSTOM,delete(n)),'1')
    check('rollback header absent '+str(n),actor(ADMIN,f"SELECT count(*) FROM public.sales_orders WHERE id='{oid(n)}';"),'0')
check('rollback cannot delete populated Draft',actor(CUSTOM,delete(5)),'0')
check('rollback cannot delete confirmed order',actor(ADMIN,delete(1)),'0')
check('other creator empty draft fixture',actor(ADMIN,header(9,ADMIN)),oid(9))
check('rollback cannot delete another creator header',actor(CUSTOM,delete(9)),'0')
check('timestamped empty confirmed fixture',actor(ADMIN,header(10,ADMIN,'CONFIRMED',confirmed=True)),oid(10))
check('rollback cannot delete timestamped confirmation',actor(ADMIN,delete(10)),'0')
check('unauthorized delete affects no rows',actor(NONE,delete(9)),'0')
check('delete cannot use missing identity claims',actor('',delete(9)),'0')

check('empty draft for create permission removal',actor(CUSTOM,header(11,CUSTOM)),oid(11))
check('remove custom sales:create',"DELETE FROM public.role_permissions rp USING public.role_definitions rd,public.permissions p WHERE rp.role_id=rd.id AND rp.permission_id=p.id AND rd.role_code='rls_custom' AND p.permission_code='sales:create';")
check('rollback denied after create permission removed',actor(CUSTOM,delete(11)),'0')
check('insert denied after create permission removed',actor(CUSTOM,header(12,CUSTOM)),error='row-level security')
check('line insert denied when no create/update permission',actor(CUSTOM,line(11)),error='row-level security')
check('read-only line visibility preserved',actor(CUSTOM,f"SELECT count(*) FROM public.sales_order_items WHERE order_id='{oid(1)}';"),'1')
check('read-only cannot delete line',actor(CUSTOM,change(1,f"DELETE FROM public.sales_order_items WHERE order_id='{oid(1)}'")),'0')

check('final header policies are permission-based only',"SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='sales_orders' AND (COALESCE(qual,'') || COALESCE(with_check,'')) LIKE '%primary_role_id%';",'0')
check('final header policy count',"SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='sales_orders';",'4')
check('all policy permission codes seeded',"SELECT count(*) FROM (VALUES ('sales:read'),('sales:create'),('sales:update')) codes(code) WHERE NOT EXISTS(SELECT 1 FROM public.permissions p WHERE p.permission_code=codes.code);",'0')
p=run("SELECT json_agg(json_build_object('name',policyname,'command',cmd,'roles',roles,'using',qual,'with_check',with_check) ORDER BY policyname) FROM pg_policies WHERE schemaname='public' AND tablename='sales_orders';")
assert p.returncode==0,p.stderr
(HERE/'final-policies.json').write_text(json.dumps(json.loads(p.stdout),indent=2))
(HERE/'database-results.json').write_text(json.dumps(results,indent=2))
summary={'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results)}
print(json.dumps(summary))
raise SystemExit(1 if summary['failed'] else 0)
