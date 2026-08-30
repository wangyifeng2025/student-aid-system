export interface AdvisorClass {
  id: number;
  name: string;
}

export interface Advisor {
  id: number;
  dept_id: number;
  dept_name: string;
  staff_no: string;
  name: string;
  phone: string;
  user_id?: number;
  username?: string;
  initial_password?: string;
  classes: AdvisorClass[];
}

export interface AdvisorInput {
  dept_id: number;
  staff_no: string;
  name: string;
  phone: string;
  class_ids: number[];
}

export interface AdvisorFilter {
  page?: number;
  page_size?: number;
  dept_id?: number;
  keyword?: string;
}
