import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import ExcelJS from 'exceljs';
import { pool } from '../../db/pool';
import { VirtualClassroomDAO } from './virtual-classroom.dao';
import { VirtualClassroomService } from './virtual-classroom.service';
import { candidatesQuerySchema, exportPreviewSchema, exportSchema } from './virtual-classroom.schema';

afterEach(() => mock.restoreAll());
const areaA = '00000000-0000-4000-8000-000000000071';
const areaB = '00000000-0000-4000-8000-000000000072';
const scheduleA = '00000000-0000-4000-8000-000000000081';
const scheduleB = '00000000-0000-4000-8000-000000000082';
const actor = { id: '00000000-0000-4000-8000-000000000004', rol: 'SUPER_ADMIN', permisos: [] };

test('academic areas filter candidates, with area counts and program labels independent of Moodle category', async () => {
  mock.method(pool, 'query', async (sql: string) => {
    assert.match(sql, /JOIN areas_conocimiento/);
    return { rows: [areaA, areaB].map((area_id, index) => ({
      area_id, area_nombre: index ? 'Educación' : 'Ingeniería y Tecnología',
      programa_id: `program-${index}`, programa_nombre: `Programa ${index}`,
      cohorte_id: `cohort-${index}`, codigo_cohorte: `C-${index}`,
      schedule_id: index ? scheduleB : scheduleA, effective_category: 'old-moodle-category',
    })) } as any;
  });
  const result = await VirtualClassroomService.candidates({ area_id: areaA } as any, actor);
  assert.deepEqual(result.areas, [
    { id: areaA, nombre: 'Ingeniería y Tecnología', course_count: 1 },
    { id: areaB, nombre: 'Educación', course_count: 1 },
  ]);
  assert.deepEqual(result.schedules.map(row => [row.id, row.area_id, row.programa_nombre]), [[scheduleA, areaA, 'Programa 0']]);
  assert.equal((await VirtualClassroomService.candidates({ area_id: '00000000-0000-4000-8000-000000000099' } as any, actor)).schedules.length, 0);
});

test('area UUID is retained and validated in all export boundary schemas', () => {
  assert.equal(candidatesQuerySchema.parse({ area_id: areaA }).area_id, areaA);
  assert.equal(exportPreviewSchema.parse({ schedule_ids: [scheduleA], area_id: areaA }).area_id, areaA);
  assert.equal(exportSchema.parse({ schedule_ids: [scheduleA], format: 'xlsx', area_id: areaA }).area_id, areaA);
  for (const schema of [candidatesQuerySchema, exportPreviewSchema, exportSchema]) {
    assert.equal(schema.safeParse({ schedule_ids: [scheduleA], format: 'xlsx', area_id: 'bad' }).success, false);
  }
});

function exportFixtures() {
  const schedules = [scheduleA, scheduleB].map((schedule_id, index) => ({
    schedule_id, area_id: index ? areaB : areaA, area_nombre: index ? 'Educación' : 'Ingeniería y Tecnología',
    shortname: `COURSE-${index}`, category: 'legacy', teacher_role: 'teacher', course_mapping_id: `mapping-${index}`,
    teacher_id: 'teacher', componente_nombre: `Curso ${index}`, codigo_cohorte: `C-${index}`, programa_nombre: `Programa ${index}`,
  }));
  const saved: any[] = [];
  mock.method(VirtualClassroomDAO, 'exportContext', async (ids: string[]) => ({ rows: schedules.filter(row => ids.includes(row.schedule_id)) } as any));
  mock.method(VirtualClassroomDAO, 'proposalDefaults', async () => ({ rows: [] } as any));
  mock.method(VirtualClassroomDAO, 'courseCodeOwners', async () => ({ rows: [] } as any));
  mock.method(VirtualClassroomDAO, 'globalProposalPeople', async () => ({ rows: [] } as any));
  mock.method(VirtualClassroomDAO, 'usernameOwners', async () => ({ rows: [] } as any));
  mock.method(VirtualClassroomDAO, 'exportPeople', async (ids: string[]) => ({ rows: ids.map(schedule_id => ({
    schedule_id, person_key: 'user:shared', username: 'ana', verified: true, firstname: 'Ana', lastname: 'Pérez', email: 'ana@example.test', kind: 'student', role: 'student',
  })) } as any));
  mock.method(VirtualClassroomDAO, 'saveExport', async (input: any) => { saved.push(input); return { id: 'export' }; });
  return { schedules, saved };
}

test('area export excludes other-area pairs in all formats and removes category from course files', async () => {
  const { saved } = exportFixtures();
  for (const format of ['users_csv', 'courses_csv', 'xlsx'] as const) {
    const result = await VirtualClassroomService.createExport([scheduleA], format, actor, undefined, areaA);
    assert.equal(saved.at(-1).snapshot.area_id, areaA);
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Uint8Array.from(result.content).buffer);
      assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Usuarios', 'Cursos']);
      assert.deepEqual((workbook.getWorksheet('Cursos')!.getRow(1).values as ExcelJS.CellValue[]).slice(1), ['shortname', 'fullname', 'summary']);
      assert.equal(workbook.getWorksheet('Cursos')!.rowCount, 2);
      assert.equal(workbook.getWorksheet('Usuarios')!.getRow(2).getCell(5).value, 'COURSE-0');
    } else {
      const text = result.content.toString('utf8');
      assert.doesNotMatch(text, /COURSE-1|legacy/);
      if (format === 'courses_csv') assert.equal(text.split('\r\n')[0], '\uFEFFshortname,fullname,summary');
      else assert.match(text, /ana,Ana,Pérez,ana@example.test,COURSE-0,student/);
    }
  }
  const unfiltered = await VirtualClassroomService.createExport([scheduleA, scheduleB], 'users_csv', actor);
  assert.match(unfiltered.content.toString(), /course1,role1,course2,role2/);
  assert.match(unfiltered.content.toString(), /COURSE-0,student,COURSE-1,student/);
});

test('mixed or reassigned area selections fail without saving any export', async () => {
  const { schedules, saved } = exportFixtures();
  await assert.rejects(VirtualClassroomService.createExport([scheduleA, scheduleB], 'users_csv', actor, undefined, areaA), (error: any) => error.statusCode === 409);
  await VirtualClassroomService.previewExport([scheduleA], undefined, areaA);
  schedules[0].area_id = areaB;
  await assert.rejects(VirtualClassroomService.createExport([scheduleA], 'xlsx', actor, undefined, areaA), (error: any) => error.statusCode === 409);
  assert.equal(saved.length, 0);
});
