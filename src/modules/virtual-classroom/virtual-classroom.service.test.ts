import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { VirtualClassroomDAO } from './virtual-classroom.dao';
import { VirtualClassroomService } from './virtual-classroom.service';

afterEach(() => mock.restoreAll());

const scheduleId = '00000000-0000-4000-8000-000000000012';
const actor = { id: '00000000-0000-4000-8000-000000000004', rol: 'SUPER_ADMIN', permisos: [] };
function setup(mapped: any[] = [{ username:'moodle.user',verified:true,student_name:'Lucía Álvarez',codigo_expediente:'PEP-1',enrollment_id:'enrollment',grade_id:null,current_grade:null }]) {
  const state = { insertCalls: [] as any[], snapshotCalls: 0 };
  mock.method(VirtualClassroomDAO,'schedule',async () => ({ rows:[{ id:scheduleId,actas_notas_cerradas:false,docente_usuario_id:actor.id }] } as any));
  mock.method(VirtualClassroomDAO,'gradePreviewSnapshot',async () => { state.snapshotCalls++; return { rows:mapped } as any; });
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
  assert.equal(state.snapshotCalls,1);
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

test('CSV parsing preserves distinct numeric-looking Moodle usernames as text', async () => {
  const state = setup([
    { username:'00123',verified:true,student_name:'Leading zero',codigo_expediente:'A',enrollment_id:'A',grade_id:null,current_grade:null },
    { username:'123',verified:true,student_name:'No leading zero',codigo_expediente:'B',enrollment_id:'B',grade_id:null,current_grade:null },
  ]);
  const result = await VirtualClassroomService.previewGrades(scheduleId,
    file('Username,Final grade\n"00123",85\n"123",90\n'),'Username','Final grade',actor);
  assert.equal(result.can_confirm,true);
  assert.deepEqual(result.rows.map(row => row.username),['00123','123']);
  assert.equal(state.snapshotCalls,1);
});
