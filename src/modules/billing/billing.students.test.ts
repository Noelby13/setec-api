import assert from 'node:assert/strict';
import { afterEach,mock,test } from 'node:test';
import express from 'express';
import { pool } from '../../db/pool';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';
import { discoverBillingStudents } from './billing.students';
afterEach(()=>mock.restoreAll());
function fixture(permissions:string[]) {
  const query=mock.fn(async(sql:string,_values?:unknown[])=>({rows:sql.includes('count(*)')?[{total:1}]:sql.includes('SELECT a.id')?[{id:'student',nombres:'Ana',apellidos:'Pérez',tipo_identificacion:'PASAPORTE',identificacion_terminacion:'1234',email:'private@example.test',numero_identificacion:'PRIVATE-1234'}]:[]}));
  const connect=mock.method(pool,'connect',async()=>({query,release(){}}) as any);
  const app=express();app.use((req,_res,next)=>{req.user={id:'operator',rol:'CAJERO',permisos:permissions};next();});app.get('/students',discoverBillingStudents);app.use(errorHandler);
  return {app,query,connect};
}
test('cashier can find a student before choosing cohorts without exposing unrelated profile fields',async()=>{
  const f=fixture(['PAGO_VALIDAR']);
  const response=await httpRequest(f.app,'/students?search=Ana&page=1&limit=10');
  assert.equal(response.status,200);assert.equal(response.body.data[0].identificacion_terminacion,'1234');assert.equal(response.body.pagination.total,1);
  assert.equal('email' in response.body.data[0],false);assert.equal('numero_identificacion' in response.body.data[0],false);
  assert.deepEqual(Object.keys(response.body.data[0]).sort(),['apellidos','id','identificacion_terminacion','nombres','tipo_identificacion']);
  assert.deepEqual(response.body.pagination,{total:1,page:1,limit:10,totalPages:1});
  assert.equal(f.query.mock.calls[0].arguments[0],'BEGIN');
  assert.equal(f.query.mock.calls[1].arguments[0],'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(f.query.mock.calls.at(-1)!.arguments[0],'COMMIT');
});
test('student discovery denies missing permissions before touching the database',async()=>{
  const f=fixture([]);assert.equal((await httpRequest(f.app,'/students')).status,403);assert.equal(f.connect.mock.callCount(),0);
});
test('student discovery rejects malformed or excessive queries before touching the database',async()=>{
  const f=fixture(['PAGO_VALIDAR']);
  for(const query of ['page=0','page=-1','page=1.5','page=no','page=9007199254740992','limit=0','limit=51','limit=1.5','page=1&page=2','search='+ 'x'.repeat(121)]){
    assert.equal((await httpRequest(f.app,'/students?'+query)).status,400,query);
  }
  assert.equal(f.connect.mock.callCount(),0);
});
test('enrollment operators use defaults and search through parameterized linked-person queries',async()=>{
  const f=fixture(['INSCRIPCION_VALIDAR']);
  const response=await httpRequest(f.app,'/students?search='+encodeURIComponent("  EXP-'%_  "));
  assert.equal(response.status,200);
  const count=f.query.mock.calls.find(call=>call.arguments[0].includes('count(*)'))!;
  const list=f.query.mock.calls.find(call=>call.arguments[0].includes('SELECT a.id'))!;
  assert.deepEqual(count.arguments[1],["%EXP-'\\%\\_%"]);
  assert.deepEqual(list.arguments[1],["%EXP-'\\%\\_%",10,0]);
  assert.match(count.arguments[0],/WHERE EXISTS .*SELECT 1 FROM inscripciones/s);
  assert.match(count.arguments[0],/concat_ws.*nombres.*apellidos/s);
  assert.match(count.arguments[0],/numero_identificacion ILIKE \$1/);
  assert.match(count.arguments[0],/codigo_expediente ILIKE \$1/);
  assert.equal(count.arguments[0].includes("EXP-'"),false);
  assert.deepEqual(response.body.pagination,{total:1,page:1,limit:10,totalPages:1});
});
test('student discovery passes bounded paging and a stable ordering to the database',async()=>{
  const f=fixture(['PAGO_VALIDAR']);
  const response=await httpRequest(f.app,'/students?page=3&limit=50');
  assert.equal(response.status,200);
  const list=f.query.mock.calls.find(call=>call.arguments[0].includes('SELECT a.id'))!;
  assert.deepEqual(list.arguments[1],['%%',50,100]);
  assert.match(list.arguments[0],/ORDER BY a.apellidos,a.nombres,a.id LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(response.body.pagination,{total:1,page:3,limit:50,totalPages:1});
});
