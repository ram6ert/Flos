export interface Homework {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  content: string;
  dueDate: string; // ISO string from main process
  maxScore: number;
  submissionStatus: "submitted" | "not_submitted" | "graded";
  studentScore: number | null;
  submitDate: string | null; // ISO string from main process
  submittedCount: number;
  totalStudents: number;
  type: "homework" | "report" | "experiment" | "quiz" | "assessment";
  submissionId: string | null;
  userId: string;
}

export interface HomeworkDetails {
  id: number;
  createdDate: string; // ISO string from main process
  courseId: number;
  courseSchedId: number;
  content: string;
  title: string;
  dueDate: string; // ISO string from main process
  openDate: string; // ISO string from main process
  isFinalExam: boolean;
  maxScore: number;
  moduleId: number;
  isOpen: boolean;
  isAnswerPublished: boolean;
  status: string;
  referenceAnswer: string;
  reviewMethod: string;
  url: string;
  fileName: string;
  convertUrl: string;
  fileSize: number;
  makeupTime: string | null; // ISO string from main process
  isRepeatAllowed: boolean;
  makeupFlag: string;
  selectedIds: string | null;
  isGroupAssignment: boolean;
  teacherWeight: number;
  studentWeight: number;
  studentCompletion: boolean;
  evaluationNumber: number;
  attachments?: HomeworkAttachment[];
}

export interface HomeworkAttachment {
  id: number;
  url: string;
  fileName: string;
  convertUrl: string;
  fileSize: number;
  type?: "homework" | "answer" | "my_homework";
}

export interface HomeworkDetailsResponse {
  homeWork: HomeworkDetails;
  picList: HomeworkAttachment[];
  answerPicList: HomeworkAttachment[];
  STATUS: string;
  message: string;
}
