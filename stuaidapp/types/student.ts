// 学生学籍档案（与 backend/internal/dto/student.go StudentResponse 对齐）

export interface StudentProfile {
  id: number;
  user_id: number;
  student_no: string;
  name: string;
  gender: string;
  birth: string;
  nation: string;
  political_status: string;
  id_card: string;
  phone: string;
  enroll_time: string;
  dept_id: number;
  major_id: number;
  class_id: number;
  is_key_group: boolean;
}
