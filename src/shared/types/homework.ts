export interface Homework {
  id: string; // Internal numeric homework ID (string, e.g., "12345")
  courseId: string; // Internal numeric course ID (string, e.g., "67890")
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
  submissionId: string | null; // Internal numeric submission ID (string, if submitted)
  userId: string; // Internal numeric user/student ID (string)
}

export interface HomeworkDetails {
  id: string; // Internal numeric homework ID (string)
  createdDate: string; // ISO string from main process
  courseId: string; // Internal numeric course ID (string)
  courseSchedId: string; // Internal numeric schedule ID (string)
  content: string;
  title: string;
  dueDate: string; // ISO string from main process
  openDate: string; // ISO string from main process
  isFinalExam: boolean;
  maxScore: number;
  moduleId: string; // Internal numeric module ID (string)
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
  selectedIds: string | null; // Comma-separated numeric student IDs
  isGroupAssignment: boolean;
  teacherWeight: number;
  studentWeight: number;
  studentCompletion: boolean;
  evaluationNumber: number;
  attachments?: HomeworkAttachment[];
}

export interface HomeworkAttachment {
  id: string; // Internal numeric attachment ID (string, e.g., "12345")
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
