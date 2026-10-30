/** Owned, network-isolated PostgreSQL only. Never reads application configuration. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { programIdParamSchema } from '../src/modules/programs/program.schema.ts';
const root = new URL('../', import.meta.url);
const repair = readFileSync(new URL('database/demo_uuid_repair.sql',root),'utf8');
const archived = spawnSync('git',['show','f9532e1:database/demo_bulk_load.sql'],{cwd:fileURLToPath(root),encoding:'utf8'});
assert.equal(archived.status,0,archived.stderr);
const oldLoad = archived.stdout;
const container = `pep-demo-uuid-${randomBytes(6).toString('hex')}`;
let owned=false;
const checks=[];
const enabled="SET demo.allow_uuid_repair='yes';\n";
function docker(args,input){return spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:240000,maxBuffer:64*1024*1024});}
function query(sql,success=true){const r=docker(['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','demo_test'],sql);assert.equal(r.status===0,success,r.stderr);return r;}
function json(sql){return JSON.parse(query(sql).stdout.trim());}
function tables(){return json("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'");}
function snapshot(){return json(`SELECT jsonb_build_object(${tables().map(t=>`'${t}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM "${t}" t)`).join(',')})`);}
function constraints(){return query("SELECT conrelid::regclass,conname,pg_get_constraintdef(oid),condeferrable,condeferred,convalidated FROM pg_constraint WHERE contype='f' ORDER BY conrelid::regclass::text,conname").stdout;}
function canonical(s,map=new Map()){return Object.fromEntries(Object.entries(s).map(([t,rows])=>[t,rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'&&map.has(v)?map.get(v):v]))).map(JSON.stringify).sort()]));}
function refusal(setup,reason){query(setup);const s=snapshot(),f=constraints();assert.match(query(enabled+repair,false).stderr,reason);assert.deepEqual(snapshot(),s);assert.equal(constraints(),f);}
try {
 const start=docker(['run','--pull=never','--rm','-d','--network','none','--name',container,'-e',`POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`,'-e','POSTGRES_DB=demo_test','postgres:16-alpine']);assert.equal(start.status,0,start.stderr);owned=true;
 let ready=false;for(let i=0;i<100;i++){if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','demo_test']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 query(readFileSync(new URL('database/schema.sql',root),'utf8'));
 query("INSERT INTO areas_conocimiento(nombre,slug) VALUES('Original area','original-area')");
 const original=query("SELECT to_jsonb(t) FROM areas_conocimiento t WHERE slug='original-area'").stdout;
 query(`INSERT INTO roles(nombre) VALUES('ORIGINAL_FIXTURE');
 INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id) SELECT '11f5edbd-6455-4f09-9413-6548199c8f78','original.user','original@example.invalid','disabled','Original','User',id FROM roles WHERE nombre='ORIGINAL_FIXTURE';
 INSERT INTO virtual_classroom_exports(created_by,format,filename,content_type,content_bytes,content_snapshot)
 VALUES('11f5edbd-6455-4f09-9413-6548199c8f78','users_csv','original.csv','text/csv',convert_to('original artifact bytes','UTF8'),'{"courses":[{"schedule_id":"8c33c7e2-51ca-4e48-996a-cfc96a54d363"}],"people":[],"issues":[]}');`);
 query("SET demo.allow_seed='yes';\n"+oldLoad);
 const broken=query("SELECT id FROM programas_academicos WHERE codigo_interno='MAE-SIS'").stdout.trim();
 assert.equal(programIdParamSchema.safeParse({id:broken}).success,false,'RED: actual API rejects archived demo IDs');
 checks.push('RED observed: actual API UUID schema rejects archived demo program');
 query(`CREATE TABLE later_uuid_reference(id uuid PRIMARY KEY,program_id uuid REFERENCES programas_academicos(id), parent_id uuid REFERENCES later_uuid_reference(id),unrelated_uuid uuid);
 INSERT INTO later_uuid_reference SELECT '11111111-1111-4111-8111-111111111111',id,'11111111-1111-4111-8111-111111111111',(SELECT id FROM usuarios WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' LIMIT 1) FROM programas_academicos WHERE codigo_interno='MAE-SIS';
 ALTER TABLE programas_tags ADD CONSTRAINT composite_test_unique UNIQUE(programa_id,tag_id);
 CREATE TABLE later_composite_reference(program_id uuid,tag_id uuid,FOREIGN KEY(program_id,tag_id) REFERENCES programas_tags(programa_id,tag_id));
 INSERT INTO later_composite_reference SELECT programa_id,tag_id FROM programas_tags LIMIT 1;`);
 const initial=snapshot(),initialFk=constraints(),seq=query('SELECT last_value,is_called FROM comprobantes_internos_numero_seq').stdout;
 assert.match(query(repair,false).stderr,/explicit/);assert.deepEqual(snapshot(),initial);
 assert.match(query(enabled+repair.replace(/^COMMIT;$/m,"DO $$ BEGIN RAISE EXCEPTION 'late failure'; END $$; COMMIT;"),false).stderr,/late failure/);
 assert.deepEqual(snapshot(),initial);assert.equal(constraints(),initialFk);
 checks.push('explicit opt-in and late failure preserve all rows and exact FK definitions');
 refusal("INSERT INTO certificados_registro(expediente_id,titular_nombre,programa_nombre,cohorte_codigo,tipo_documento,fecha_emision,documento_url,documento_sha256,registrado_por_usuario_id) SELECT id,'Holder','Program','Cohort','DIPLOMA_PROFESIONAL',current_date,'/fixture',repeat('a',64),(SELECT id FROM usuarios WHERE username='demo.operador' LIMIT 1) FROM expediente_graduacion_certificacion LIMIT 1",/protected history/);
 query('DELETE FROM certificados_registro');
 refusal("INSERT INTO virtual_classroom_grade_previews(schedule_id,actor_id,source_filename,source_bytes,preview_rows,fingerprint,expires_at) SELECT id,(SELECT id FROM usuarios WHERE username='demo.operador' LIMIT 1),'fixture.csv',decode('00','hex'),'[]','fixture',now()+interval '1 hour' FROM programacion_componentes_cohorte LIMIT 1",/protected history/);
 query('DELETE FROM virtual_classroom_grade_previews');
 refusal("INSERT INTO virtual_classroom_exports(created_by,format,filename,content_type,content_bytes,content_snapshot) SELECT '11f5edbd-6455-4f09-9413-6548199c8f78','users_csv','fixture.csv','text/csv',decode('00','hex'),jsonb_build_object('person','user:'||id,'courses','[]'::jsonb,'people','[]'::jsonb,'issues','[]'::jsonb) FROM usuarios WHERE username='demo.operador' LIMIT 1",/protected history|embedded identity/);
 query("DELETE FROM virtual_classroom_exports WHERE filename='fixture.csv'");
 refusal("UPDATE virtual_classroom_exports SET content_bytes=convert_to((SELECT id::text FROM programas_academicos WHERE codigo_interno='MAE-SIS'),'UTF8') WHERE filename='original.csv'",/export bytes/);
 query("UPDATE virtual_classroom_exports SET content_bytes=convert_to('original artifact bytes','UTF8') WHERE filename='original.csv'");
 refusal("INSERT INTO sesiones(usuario_id,payload,refresh_token_hash,expiracion_token) SELECT id,'fixture','fixture',now()+interval '1 hour' FROM usuarios WHERE username='demo.operador' LIMIT 1",/protected history/);
 query('DELETE FROM sesiones');
 refusal("UPDATE auditoria_economica SET detalle=jsonb_build_object('user',(SELECT id FROM usuarios WHERE username='demo.operador' LIMIT 1)) WHERE id=(SELECT id FROM auditoria_economica LIMIT 1)",/embedded identity/);
 query("UPDATE auditoria_economica SET detalle='{\"demo\":true,\"version\":2}' WHERE detalle ? 'user'");

 refusal("ALTER TABLE later_uuid_reference DROP CONSTRAINT later_uuid_reference_program_id_fkey; ALTER TABLE later_uuid_reference ADD CONSTRAINT later_uuid_reference_program_id_fkey FOREIGN KEY(program_id) REFERENCES programas_academicos(id) ON UPDATE CASCADE",/unsupported ON UPDATE/);
 query("ALTER TABLE later_uuid_reference DROP CONSTRAINT later_uuid_reference_program_id_fkey; ALTER TABLE later_uuid_reference ADD CONSTRAINT later_uuid_reference_program_id_fkey FOREIGN KEY(program_id) REFERENCES programas_academicos(id)");
 refusal("INSERT INTO usuarios(id,username,email,password_hash,nombres,apellidos,rol_id,activo) SELECT '6b8d80fd-47c7-35d7-b4e7-7afc1b9215df','collision','collision@example.invalid','disabled','Collision','Fixture',id,false FROM roles LIMIT 1",/destination collision/);
 query("DELETE FROM usuarios WHERE username='collision'");
 checks.push('certificate snapshots, preview fingerprints, export bytes, sessions and embedded JSON identities refuse atomically');
 const output=query(enabled+repair.replace(/^COMMIT;$/m,"SELECT 'MAP:'||json_agg(json_build_array(old_id,new_id)) FROM demo_uuid_identity; COMMIT;")).stdout;
 const pairs=JSON.parse(output.split('\n').find(l=>l.startsWith('MAP:')).slice(4));
 const inverse=new Map(pairs.map(([a,b])=>[b,a]));
 assert.deepEqual(canonical(snapshot(),inverse),canonical(initial),'all row data other than exact identities is preserved');
 assert.equal(constraints(),initialFk);assert.equal(query('SELECT last_value,is_called FROM comprobantes_internos_numero_seq').stdout,seq);
 assert.equal(query("SELECT to_jsonb(t) FROM areas_conocimiento t WHERE slug='original-area'").stdout,original);
 const fixed=query("SELECT id FROM programas_academicos WHERE codigo_interno='MAE-SIS'").stdout.trim();assert.equal(programIdParamSchema.safeParse({id:fixed}).success,true);
 for(const [,id] of pairs)assert.equal(z.string().uuid().safeParse(id).success,true);
 const uuidColumns=json("SELECT json_agg(json_build_array(c.relname,a.attname)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid='uuid'::regtype");
 const oldIds=new Set(pairs.map(([a])=>a));
 for(const [t,col] of uuidColumns){const vals=json(`SELECT coalesce(json_agg(DISTINCT "${col}"),'[]') FROM "${t}" WHERE "${col}" IS NOT NULL`);for(const id of vals){if(!(t==='later_uuid_reference'&&col==='unrelated_uuid'))assert.equal(oldIds.has(id),false,`${t}.${col} old ID remains`);assert.equal(z.string().uuid().safeParse(id).success,true,`${t}.${col} UUID rejected`);}}
 checks.push('all identities and references pass actual Zod; exact nonidentity rows, originals, financial sequences, composite/self/later FKs and polymorphic accounts preserved');
 const once=snapshot();query(enabled+repair);assert.deepEqual(snapshot(),once);assert.equal(constraints(),initialFk);
 // Independently replace only the archived helper to verify the agreed nested recipe.
 const corrected=oldLoad.replace(/CREATE OR REPLACE FUNCTION pg_temp.demo_id\(key text\) RETURNS uuid\nLANGUAGE sql IMMUTABLE STRICT AS \$\$ SELECT md5\('pep-demo-v2:' \|\| key\)::uuid \$\$;/,()=>`CREATE OR REPLACE FUNCTION pg_temp.demo_id(key text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE STRICT AS $$ DECLARE b bytea:=decode(md5(uuid_send('4a47ba67-d994-42b8-8ca0-ce2136c9a891'::uuid)||convert_to('pep-demo-v2:'||key,'UTF8')),'hex'); BEGIN b:=set_byte(b,6,(get_byte(b,6)&15)|48); b:=set_byte(b,8,(get_byte(b,8)&63)|128); RETURN encode(b,'hex')::uuid; END $$;`);
 assert.notEqual(corrected,oldLoad);
 query("SET demo.allow_seed='yes';\n"+corrected);assert.deepEqual(snapshot(),once);assert.equal(query('SELECT last_value,is_called FROM comprobantes_internos_numero_seq').stdout,seq);
 query("SET demo.allow_seed='yes';\n"+readFileSync(new URL('database/demo_bulk_load.sql',root),'utf8'));assert.deepEqual(snapshot(),once);assert.equal(query('SELECT last_value,is_called FROM comprobantes_internos_numero_seq').stdout,seq);
 checks.push('repair rerun, independent canonical helper and actual corrected workspace loader rerun are exact no-ops');
 console.log(JSON.stringify({passed:true,checks,mapped:pairs.length},null,2));
} finally {if(owned)assert.equal(docker(['rm','-f','-v',container]).status,0);}
