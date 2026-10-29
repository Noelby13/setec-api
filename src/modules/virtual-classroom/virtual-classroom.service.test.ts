import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { VirtualClassroomDAO } from './virtual-classroom.dao';
import { VirtualClassroomService } from './virtual-classroom.service';

afterEach(() => mock.restoreAll());

const scheduleId = '00000000-0000-4000-8000-000000000012';
const actor = { id: '00000000-0000-4000-8000-000000000004', rol: 'SUPER_ADMIN', permisos: [] };
function setup(mapped: any[] = [{ username:'moodle.user',student_name:'Lucía Álvarez',codigo_expediente:'PEP-1',inscripcion_id:'enrollment',current_grade:null }]) {
  const state = { insertCalls: [] as any[], queryCalls: [] as any[] };
  mock.method(VirtualClassroomDAO,'schedule',async () => ({ rows:[{ id:scheduleId,actas_notas_cerradas:false,docente_usuario_id:actor.id }] } as any));
  mock.method(VirtualClassroomDAO,'previewRows',async (_id: string,usernames: string[]) => { state.queryCalls.push(usernames); return { rows:mapped.filter(row => usernames.includes(row.username)) } as any; });
  mock.method(VirtualClassroomDAO,'gradeFingerprint',async () => ({ rows:[{ enrollment_id:'enrollment',username:'moodle.user',grade_id:null,calificacion_cuantitativa:null }] } as any));
  mock.method(VirtualClassroomDAO,'insertPreview',async (input: any) => { state.insertCalls.push(input); return { rows:[] } as any; });
  return state;
}
function file(text: string): Express.Multer.File {
  return { originalname:'moodle.csv',mimetype:'text/csv',buffer:Buffer.from(text,'utf8') } as Express.Multer.File;
}

test('preview maps only a verified username and keeps internal enrollment identifiers server-side', async () => {
  const state = setup();
  const result = await VirtualClassroomService.previewGrades(scheduleId,file('Username,Final grade\r\nmoodle.user,95\r\n'),'Username','Final grade',actor);
  assert.equal(result.can_confirm,true);
  assert.equal(result.rows[0].status,'new');
  assert.equal(result.rows[0].student_name,'Lucía Álvarez');
  assert.equal('enrollment_id' in result.rows[0],false);
  assert.equal(state.insertCalls.length,1);
  assert.equal(state.insertCalls[0].actorId,actor.id);
  assert.equal(state.insertCalls[0].rows[0].enrollment_id,'enrollment');
  assert.deepEqual(state.queryCalls[0],['moodle.user']);
});

test('bad grades, duplicate usernames, formula-like values, and unknown accounts cannot create a confirmable preview', async () => {
  const state = setup();
  const input = 'Username,Final grade\n=2+2,70\nmoodle.user,101\nmoodle.user,80\nunknown.user,85\n';
  const result = await VirtualClassroomService.previewGrades(scheduleId,file(input),'Username','Final grade',actor);
  assert.equal(result.can_confirm,false);
  assert.equal(result.preview_id,undefined);
  assert.ok(result.rows.every(row => row.status==='error'));
  assert.equal(state.insertCalls.length,0);
  assert.ok(result.issues.some(issue => issue.code==='ROW_ERRORS'));
});

test('unselected columns return the source headers without creating server confirmation state', async () => {
  const state = setup();
  const result = await VirtualClassroomService.previewGrades(scheduleId,file('Cuenta,Nota final\nmoodle.user,85\n'),undefined,undefined,actor);
  assert.deepEqual(result.columns,['Cuenta','Nota final']);
  assert.equal(result.can_confirm,false);
  assert.equal(state.insertCalls.length,0);
});
