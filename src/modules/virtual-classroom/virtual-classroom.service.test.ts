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

test('export preview proposes stable course and account values without confirming them', async () => {
  const schedule = { schedule_id:scheduleId,shortname:null,codigo_aula_virtual_externa:null,
    category:null,teacher_role:null,fullname:null,summary:null,componente_codigo:'VCLASS',programa_id:'00000000-0000-4000-8000-000000000021',
    cohorte_id:'00000000-0000-4000-8000-000000000022',componente_id:'00000000-0000-4000-8000-000000000023',
    componente_nombre:'Gestión Pública',codigo_cohorte:'PEP-1',programa_nombre:'Posgrados',fecha_inicio:'2026-11-01',
    fecha_fin:'2026-11-30',teacher_id:'00000000-0000-4000-8000-000000000024',teacher_firstname:'Ana',
    teacher_lastname:'Pérez',teacher_user_id:null,teacher_suggested_username:null,teacher_email:'ana@example.test' };
  mock.method(VirtualClassroomDAO,'exportContext',async () => ({ rows:[schedule] } as any));
  mock.method(VirtualClassroomDAO,'courseCodeOwners',async () => ({ rows:[{schedule_id:'00000000-0000-4000-8000-000000000099',
    code:`pep-1-vclass-${scheduleId.replaceAll('-','')}`}] } as any));
  mock.method(VirtualClassroomDAO,'proposalDefaults',async () => ({ rows:[{schedule_id:scheduleId,category:'1',teacher_role:'editingteacher'}] } as any));
  mock.method(VirtualClassroomDAO,'exportPeople',async () => ({ rows:[
    { schedule_id:scheduleId,person_key:'teacher:00000000-0000-4000-8000-000000000024',firstname:'Ana',lastname:'Pérez',email:'ana@example.test',suggested_username:null,username:null,verified:false,kind:'teacher',role:'teacher' },
    { schedule_id:scheduleId,person_key:'user:00000000-0000-4000-8000-000000000026',firstname:'Linked',lastname:'Learner',email:'emailname@example.test',suggested_username:'linked.account',username:null,verified:false,kind:'student',role:'student' },
    { schedule_id:scheduleId,person_key:'applicant:00000000-0000-4000-8000-000000000025',firstname:'Otra',lastname:'Persona',email:'other@example.test',suggested_username:null,username:null,verified:false,kind:'student',role:'student' },
  ] } as any));
  mock.method(VirtualClassroomDAO,'globalProposalPeople',async () => ({rows:[
    {person_key:'teacher:00000000-0000-4000-8000-000000000024',email:'ana@example.test'},
    {person_key:'user:00000000-0000-4000-8000-000000000026',email:'emailname@example.test',suggested_username:'linked.account'},
    {person_key:'applicant:00000000-0000-4000-8000-000000000025',email:'other@example.test'},
  ]} as any));
  mock.method(VirtualClassroomDAO,'usernameOwners',async () => ({ rows:[
    {username:'ana',person_key:'teacher:00000000-0000-4000-8000-000000000024'},
    {username:'other',person_key:'user:00000000-0000-4000-8000-000000000099'},
  ] } as any));
  const first = await VirtualClassroomService.previewExport([scheduleId]);
  const second = await VirtualClassroomService.previewExport([scheduleId]);
  assert.equal(first.courses[0].shortname,`PEP-1-VCLASS-${scheduleId.replaceAll('-','')}-1`);
  assert.equal(first.courses[0].category,'1');
  assert.equal(first.courses[0].teacher_role,'editingteacher');
  assert.equal(first.courses[0].confirmed,false);
  assert.equal(first.people[0].username,'ana');
  assert.equal(first.people[0].verified,false);
  assert.equal(first.people[0].username,second.people[0].username);
  assert.equal(first.people[0].courses[0].role,'editingteacher');
  assert.equal(first.people[1].username,'linked.account');
  assert.equal(first.people[1].verified,false);
  assert.equal(first.people[2].username,'pep.applicant.00000000000040008000000000000025');
  assert.equal(first.people[2].username,second.people[2].username);
});

test('configured account and course overrides remain authoritative in preview and exports', async () => {
  const schedule = { schedule_id:scheduleId,shortname:'PEP-1',codigo_aula_virtual_externa:'PEP-1',category:'1',teacher_role:'teacher',
    course_mapping_id:'course-map',
    fullname_override:'Nombre revisado',summary_override:'Resumen revisado',programa_id:'00000000-0000-4000-8000-000000000021',
    programa_nombre:'Posgrados',fecha_inicio:'2026-11-01',fecha_fin:'2026-11-30',teacher_id:'00000000-0000-4000-8000-000000000024' };
  mock.method(VirtualClassroomDAO,'exportContext',async () => ({ rows:[schedule] } as any));
  mock.method(VirtualClassroomDAO,'courseCodeOwners',async () => ({ rows:[{schedule_id:scheduleId,code:'pep-1'}] } as any));
  mock.method(VirtualClassroomDAO,'proposalDefaults',async () => ({ rows:[{category:'1',teacher_role:'teacher'}] } as any));
  mock.method(VirtualClassroomDAO,'exportPeople',async () => ({ rows:[
    { schedule_id:scheduleId,person_key:'user:00000000-0000-4000-8000-000000000031',firstname:'Canonical',lastname:'Name',email:'canonical@example.test',
      suggested_username:'canonical.user',username:'edited.user',verified:true,firstname_override:'Edited',lastname_override:'Learner',email_override:'edited@example.test',kind:'student',role:'student' },
  ] } as any));
  mock.method(VirtualClassroomDAO,'globalProposalPeople',async () => ({rows:[{person_key:'user:00000000-0000-4000-8000-000000000031',
    username:'edited.user',suggested_username:'canonical.user',email:'canonical@example.test'}]} as any));
  mock.method(VirtualClassroomDAO,'usernameOwners',async () => ({ rows:[{ username:'edited.user',person_key:'user:00000000-0000-4000-8000-000000000031' }] } as any));
  const preview = await VirtualClassroomService.previewExport([scheduleId]);
  assert.equal(preview.courses[0].fullname,'Nombre revisado');
  assert.equal(preview.courses[0].summary,'Resumen revisado');
  assert.equal(preview.courses[0].confirmed,true);
  assert.deepEqual([preview.people[0].firstname,preview.people[0].lastname,preview.people[0].email],
    ['Edited','Learner','edited@example.test']);
  mock.method(VirtualClassroomDAO,'saveExport',async (input: any) => ({ rows:[{id:'export'}],input } as any));
  const result = await VirtualClassroomService.createExport([scheduleId],'users_csv',actor);
  assert.match(result.content.toString('utf8'),/edited\.user,Edited,Learner,edited@example\.test/);
  const courseExport = await VirtualClassroomService.createExport([scheduleId],'courses_csv',actor);
  assert.match(courseExport.content.toString('utf8'),/PEP-1,Nombre revisado,Resumen revisado,1/);
});

test('a conflicting saved username remains visible and blocks export instead of being replaced', async () => {
  mock.method(VirtualClassroomDAO,'exportContext',async () => ({ rows:[{ schedule_id:scheduleId,shortname:'PEP-1',codigo_aula_virtual_externa:'PEP-1',
    category:'1',teacher_role:'teacher',course_mapping_id:'course-map',componente_nombre:'Gestión Pública',codigo_cohorte:'PEP-1',
    programa_nombre:'Posgrados',teacher_id:'00000000-0000-4000-8000-000000000024' }] } as any));
  mock.method(VirtualClassroomDAO,'courseCodeOwners',async () => ({ rows:[{schedule_id:scheduleId,code:'pep-1'}] } as any));
  mock.method(VirtualClassroomDAO,'proposalDefaults',async () => ({ rows:[] } as any));
  mock.method(VirtualClassroomDAO,'exportPeople',async () => ({ rows:[{ schedule_id:scheduleId,
    person_key:'user:00000000-0000-4000-8000-000000000031',firstname:'Learner',lastname:'Person',email:'learner@example.test',
    suggested_username:'web.learner',username:'taken.name',verified:true,kind:'student',role:'student' }] } as any));
  mock.method(VirtualClassroomDAO,'globalProposalPeople',async () => ({rows:[{person_key:'user:00000000-0000-4000-8000-000000000031',
    username:'taken.name',suggested_username:'web.learner',email:'learner@example.test'}]} as any));
  mock.method(VirtualClassroomDAO,'usernameOwners',async () => ({ rows:[{ username:'taken.name',person_key:'user:00000000-0000-4000-8000-000000000032' }] } as any));
  const preview = await VirtualClassroomService.previewExport([scheduleId]);
  assert.equal(preview.people[0].username,'taken.name');
  assert.ok(preview.issues.some(issue=>issue.code==='USERNAME_CONFLICT'));
  await assert.rejects(VirtualClassroomService.createExport([scheduleId],'users_csv',actor),/Resuelva los problemas/);
});

test('email-derived usernames stay stable across cohort subsets and selection order', async () => {
  const scheduleA='00000000-0000-4000-8000-000000000041';
  const scheduleB='00000000-0000-4000-8000-000000000042';
  const personA='applicant:00000000-0000-4000-8000-000000000051';
  const personB='applicant:00000000-0000-4000-8000-000000000052';
  const idA=personA.split(':')[1];
  const idB=personB.split(':')[1];
  const schedules=[scheduleA,scheduleB].map((id,index)=>({schedule_id:id,shortname:`COURSE-${index}`,codigo_aula_virtual_externa:null,
    category:'1',teacher_role:'teacher',course_mapping_id:`mapping-${index}`,componente_nombre:'Component',componente_codigo:'COMP',
    codigo_cohorte:`COHORT-${index}`,programa_nombre:'Program',teacher_id:'00000000-0000-4000-8000-000000000024'}));
  const sourceRows=[
    {schedule_id:scheduleA,person_key:personA,firstname:'Student',lastname:'A',email:'common@domain0.test',suggested_username:null,username:null,verified:false,kind:'student',role:'student'},
    {schedule_id:scheduleB,person_key:personB,firstname:'Student',lastname:'B',email:'common@domain1.test',suggested_username:null,username:null,verified:false,kind:'student',role:'student'},
  ];
  mock.method(VirtualClassroomDAO,'exportContext',async (ids:string[])=>({rows:schedules.filter(schedule=>ids.includes(schedule.schedule_id))} as any));
  mock.method(VirtualClassroomDAO,'proposalDefaults',async (ids:string[])=>({rows:ids.map(schedule_id=>({schedule_id,category:'1',teacher_role:'teacher'}))} as any));
  mock.method(VirtualClassroomDAO,'courseCodeOwners',async()=>({rows:[]} as any));
  mock.method(VirtualClassroomDAO,'exportPeople',async (ids:string[])=>({rows:sourceRows.filter(row=>ids.includes(row.schedule_id))} as any));
  let confirmedA=false;
  mock.method(VirtualClassroomDAO,'usernameOwners',async()=>({rows:confirmedA?[{username:'common',person_key:personA}]:[]} as any));
  const dao=VirtualClassroomDAO as any;
  const priorGlobalProposalPeople=dao.globalProposalPeople;
  dao.globalProposalPeople=async()=>({rows:[
    {...sourceRows[0],username:confirmedA?'common':null},sourceRows[1],
  ]});
  const expectedA=`pep.applicant.${idA.replaceAll('-','')}`;
  const expectedB=`pep.applicant.${idB.replaceAll('-','')}`;
  try {
    const aAlone=(await VirtualClassroomService.previewExport([scheduleA])).people.find(person=>person.person_key===personA);
    const bAlone=(await VirtualClassroomService.previewExport([scheduleB])).people.find(person=>person.person_key===personB);
    const together=(await VirtualClassroomService.previewExport([scheduleA,scheduleB])).people;
    const reversed=(await VirtualClassroomService.previewExport([scheduleB,scheduleA])).people;
    assert.equal(aAlone?.username,expectedA);
    assert.equal(bAlone?.username,expectedB);
    assert.equal(together.find(person=>person.person_key===personA)?.username,expectedA);
    assert.equal(together.find(person=>person.person_key===personB)?.username,expectedB);
    assert.equal(reversed.find(person=>person.person_key===personA)?.username,expectedA);
    assert.equal(reversed.find(person=>person.person_key===personB)?.username,expectedB);
    assert.notEqual(expectedA,expectedB);
    confirmedA=true;
    const afterConfirmation=(await VirtualClassroomService.previewExport([scheduleB])).people.find(person=>person.person_key===personB);
    assert.equal(afterConfirmation?.username,expectedB);
  } finally {
    if(priorGlobalProposalPeople) dao.globalProposalPeople=priorGlobalProposalPeople;
    else delete dao.globalProposalPeople;
  }
});
