"""Exercise a disposable local database after applying ONLY the bootstrap.

Usage: python scripts/bootstrap-security/database_check.py
The host/port are fixed to the local disposable server; no remote credentials.
"""
import concurrent.futures
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PSQL = ['G:/PostgreSQL/18/bin/psql.exe', '-X', '-h', '127.0.0.1', '-p', '55439', '-U', 'postgres', '-d', 'sckt_final', '-v', 'ON_ERROR_STOP=1', '-At']
results = []
def run(sql):
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True)
def check(name, sql, expected=None, denial=False):
    p = run(sql)
    # Atomic payment RPCs intentionally return success=false instead of raising.
    denied = ('permission denied' in p.stderr.lower() or 'row-level security' in p.stderr.lower()
              or ('(f,' in p.stdout and 'permission denied' in p.stdout.lower()))
    passed = denied if denial else p.returncode == 0 and (expected is None or p.stdout.strip().endswith(expected))
    results.append({'test':name, 'pass':passed, 'output':p.stdout.strip(), 'error':p.stderr.strip()})
    print(('PASS ' if passed else 'FAIL ')+name)
    return p
def as_user(uid, sql, role='authenticated'):
    return f"SET ROLE {role}; SET request.jwt.claim.sub = '{uid}'; {sql}"

ADMIN='10000000-0000-0000-0000-000000000001'
CUSTOM='10000000-0000-0000-0000-000000000002'
RESTRICTED='10000000-0000-0000-0000-000000000003'
QUALITY='10000000-0000-0000-0000-000000000004'
check('test users and roles', f"""
INSERT INTO auth.users(id,email) VALUES
('{ADMIN}','admin@test.invalid'), ('{CUSTOM}','custom@test.invalid'),
('{RESTRICTED}','restricted@test.invalid'), ('{QUALITY}','quality@test.invalid') ON CONFLICT DO NOTHING;
INSERT INTO public.role_definitions(role_code,role_name,is_system)
VALUES ('test_custom','Test custom',false),('test_restricted','Test restricted',false),('test_quality','Test quality',false) ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles_mapping(user_id,role_id)
SELECT u.id,r.id FROM auth.users u JOIN public.role_definitions r ON r.role_code =
CASE u.id WHEN '{ADMIN}' THEN 'admin' WHEN '{CUSTOM}' THEN 'test_custom' WHEN '{QUALITY}' THEN 'test_quality' ELSE 'test_restricted' END
ON CONFLICT DO NOTHING;
DELETE FROM public.role_permissions WHERE role_id IN (SELECT id FROM public.role_definitions WHERE role_code LIKE 'test_%');
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.role_definitions r CROSS JOIN public.permissions p
WHERE (r.role_code='test_custom' AND p.permission_code='masters.generic:read')
OR (r.role_code='test_quality' AND p.permission_code='quality:write');
INSERT INTO public.masters(master_type,code,name) VALUES ('test','baseline','Baseline') ON CONFLICT DO NOTHING;
""")
check('custom role read',as_user(CUSTOM,"SELECT count(*) FROM public.masters WHERE code='baseline';"),'1')
check('custom create initially denied',as_user(CUSTOM,"INSERT INTO public.masters(master_type,code,name) VALUES ('test','denied','Denied');"),denial=True)
check('grant custom create',"INSERT INTO public.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM public.role_definitions r CROSS JOIN public.permissions p WHERE r.role_code='test_custom' AND p.permission_code='masters.generic:create';")
check('custom create allowed',as_user(CUSTOM,"INSERT INTO public.masters(master_type,code,name) VALUES ('test','allowed','Allowed');"))
check('remove custom create',"DELETE FROM public.role_permissions WHERE role_id=(SELECT id FROM public.role_definitions WHERE role_code='test_custom') AND permission_id=(SELECT id FROM public.permissions WHERE permission_code='masters.generic:create');")
check('custom create denied after removal',as_user(CUSTOM,"INSERT INTO public.masters(master_type,code,name) VALUES ('test','removed','Denied');"),denial=True)
check('Admin master create',as_user(ADMIN,"INSERT INTO public.masters(master_type,code,name) VALUES ('test','admin','Admin');"))
check('restricted direct mutation',as_user(RESTRICTED,"INSERT INTO public.masters(master_type,code,name) VALUES ('test','restricted','Denied');"),denial=True)

calls={
 'inventory':"SELECT public.allocate_inventory_for_sales(gen_random_uuid(),'test',1,NULL);",
 'production':"SELECT public.complete_job_output(gen_random_uuid(),1,'Grade A','spoof');",
 'quality':"SELECT public.complete_quality_inspection(gen_random_uuid(),'Grade A',NULL,'spoof');",
 'sales':"SELECT public.confirm_sales_order(gen_random_uuid(),'spoof');",
 'reservation':"SELECT public.approve_stock_reservation_atomic(gen_random_uuid());",
 'payment':"SELECT public.allocate_payment_atomic(gen_random_uuid(),gen_random_uuid(),1);",
}
for name,call in calls.items():
    check('anon '+name,as_user('',call,'anon'),denial=True)
    check('restricted '+name,as_user(RESTRICTED,call),denial=True)
check('anon master insert',as_user('',"INSERT INTO public.masters(master_type,code,name) VALUES ('test','anon','Denied');",'anon'),denial=True)
check('anon inventory select',as_user('',"SELECT * FROM public.inventory_items;",'anon'),denial=True)
check('anon inventory view',as_user('',"SELECT * FROM public.vw_inventory_available_qty;",'anon'),denial=True)
check('Admin cost sheet delete denied',as_user(ADMIN,"DELETE FROM public.cost_sheets;"),denial=True)
check('restricted cost sheet delete denied',as_user(RESTRICTED,"DELETE FROM public.cost_sheets;"),denial=True)

ITEM='20000000-0000-0000-0000-000000000001'
A='20000000-0000-0000-0000-000000000002'
B='20000000-0000-0000-0000-000000000003'
check('reservation fixture',f"INSERT INTO public.inventory_items(id,item_type,item_code,item_name,total_qty,total_unit) VALUES ('{ITEM}','fabric','test-reservation','Test',100,'m'); INSERT INTO public.stock_reservations(id,item_id,qty_reserved,unit,reserved_by) VALUES ('{A}','{ITEM}',60,'m','test'),('{B}','{ITEM}',60,'m','test');")
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    attempts=list(pool.map(lambda reservation:run(as_user(ADMIN,f"SELECT public.approve_stock_reservation_atomic('{reservation}');")),[A,B]))
results.append({'test':'concurrent reservation 60+60 against 100', 'pass':sum(p.returncode==0 for p in attempts)==1 and sum('Insufficient stock' in p.stderr for p in attempts)==1, 'outcomes':[{'exit':p.returncode,'output':p.stdout,'error':p.stderr} for p in attempts]})
check('reservation final quantity and no partial update',f"SELECT reserved_qty || ':' || (SELECT count(*) FROM public.stock_reservations WHERE item_id='{ITEM}' AND approval_status='APPROVED') || ':' || (SELECT count(*) FROM public.stock_reservations WHERE item_id='{ITEM}' AND approval_status='PENDING') FROM public.inventory_items WHERE id='{ITEM}';",'60.00:1:1')

check('quality fixture',"""
INSERT INTO public.production_orders(id,order_no,design_no,quality_name,qty_metre,target_delivery_date)
VALUES ('30000000-0000-0000-0000-000000000010','test-production','test-design','Test',100,current_date);
INSERT INTO public.job_cards(id,card_no,production_order_id,sequence_number,qty_metre)
VALUES ('30000000-0000-0000-0000-000000000011','test-card','30000000-0000-0000-0000-000000000010',1,100);
INSERT INTO public.production_output(job_card_id,qty_produced,grade,output_item_id)
VALUES ('30000000-0000-0000-0000-000000000011',100,'Grade A','20000000-0000-0000-0000-000000000001');
INSERT INTO public.production_inspections(id,inspection_no,roll_no,item_code,design_no,loom_no,shift,roll_length_yd,roll_width_inch,total_raw_points,capped_points,points_per_100_sq_yd,system_grade,status)
VALUES ('30000000-0000-0000-0000-000000000001','test-quality','roll','item','design','loom','A',100,60,0,0,0,'Grade A','DRAFT');
UPDATE public.production_inspections SET job_card_id='30000000-0000-0000-0000-000000000011' WHERE inspection_no='test-quality';
""")
check('authorized Quality completion spoof attempt',as_user(QUALITY,"SELECT * FROM public.complete_quality_inspection('30000000-0000-0000-0000-000000000001','Grade A',NULL,'forged-actor');"))
check('Quality stored actor is auth uid',"SELECT decision_by FROM public.production_inspections WHERE id='30000000-0000-0000-0000-000000000001';",QUALITY)
check('Admin Quality fixture',"INSERT INTO public.production_inspections(id,inspection_no,roll_no,item_code,design_no,loom_no,shift,roll_length_yd,roll_width_inch,total_raw_points,capped_points,points_per_100_sq_yd,system_grade,status,job_card_id) SELECT '30000000-0000-0000-0000-000000000002','test-quality-admin',roll_no,item_code,design_no,loom_no,shift,roll_length_yd,roll_width_inch,total_raw_points,capped_points,points_per_100_sq_yd,system_grade,'DRAFT',job_card_id FROM public.production_inspections WHERE inspection_no='test-quality';")
check('Admin Quality override preserves grading',as_user(ADMIN,"SELECT final_grade || ':' || saleable_qty FROM public.complete_quality_inspection('30000000-0000-0000-0000-000000000002','Grade A','Hold','spoof');"),'Hold:0')
check('Quality Grade A quantity',"SELECT status || ':' || system_grade FROM public.production_inspections WHERE inspection_no='test-quality';",'COMPLETED:Grade A')
check('future function privileges denied',"BEGIN; CREATE FUNCTION public.test_future_acl() RETURNS int LANGUAGE sql AS 'SELECT 1'; SELECT has_function_privilege('anon','public.test_future_acl()','EXECUTE') || ':' || has_function_privilege('authenticated','public.test_future_acl()','EXECUTE'); ROLLBACK;",'false:false\nROLLBACK')

check('database ACL and object counts',"""
SELECT json_build_object(
'tables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
'views',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v'),
'functions',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace),
'triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
'rls_tables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity),
'policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public'),
'roles',(SELECT count(*) FROM public.role_definitions WHERE role_code NOT LIKE 'test_%'),
'permissions',(SELECT count(*) FROM public.permissions),
'definers',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef),
'anon_executable',(SELECT count(*) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND has_function_privilege('anon',p.oid,'EXECUTE')),
'public_executable',(SELECT count(*) FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE pronamespace='public'::regnamespace AND a.grantee=0 AND a.privilege_type='EXECUTE'),
'authenticated_functions',(SELECT json_agg(p.oid::regprocedure::text ORDER BY proname) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
'views_detail',(SELECT json_agg(json_build_object('view',relname,'owner',pg_get_userbyid(relowner),'options',reloptions,'anon_select',has_table_privilege('anon',oid,'SELECT'),'authenticated_select',has_table_privilege('authenticated',oid,'SELECT'))) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v')
);
""")
(HERE/'database-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results)}))
