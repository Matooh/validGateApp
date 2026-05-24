import { createClient } from '@/lib/supabase/server';

export type CurrentStudent = {
  studentId: number;
  profileId: string;
  institutionId: number;
  firstName: string;
  lastName: string;
  courseId: number | null;
  courseName: string | null;
  canLeaveAlone: boolean;
  isInInstitution: boolean;
};

type StudentProfileLink = {
  profile_id: string;
  institution_id: number;
  student_id: number;
};

type StudentRecord = {
  id: number;
  institution_id: number;
  course_id: number | null;
  first_name: string;
  last_name: string;
  can_leave_alone: boolean;
  is_in_institution: boolean;
  courses?: { name: string | null } | { name: string | null }[] | null;
};

function getCourseName(student: StudentRecord) {
  const course = Array.isArray(student.courses) ? student.courses[0] : student.courses;
  return course?.name ?? null;
}

export async function getCurrentStudentForAuthenticatedUser(): Promise<CurrentStudent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'ESTUDIANTE') return null;

  const { data: link } = await supabase
    .from('student_profiles')
    .select('profile_id, student_id, institution_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!link) return null;

  const typedLink = link as StudentProfileLink;
  const { data: student } = await supabase
    .from('students')
    .select(
      'id, institution_id, course_id, first_name, last_name, can_leave_alone, is_in_institution, courses(name)',
    )
    .eq('id', typedLink.student_id)
    .eq('institution_id', typedLink.institution_id)
    .maybeSingle();

  if (!student) return null;

  const typedStudent = student as StudentRecord;

  return {
    studentId: typedStudent.id,
    profileId: typedLink.profile_id,
    institutionId: typedStudent.institution_id,
    firstName: typedStudent.first_name,
    lastName: typedStudent.last_name,
    courseId: typedStudent.course_id,
    courseName: getCourseName(typedStudent),
    canLeaveAlone: typedStudent.can_leave_alone,
    isInInstitution: typedStudent.is_in_institution,
  };
}
