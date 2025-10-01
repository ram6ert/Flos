import { currentSession } from "../auth";
import { Logger } from "../logger";
import {
  authenticatedAPIRequest,
  requestQueue,
  sanitizeCourseDocument,
  convertDocumentType,
} from "./utils";

/**
 * Fetch course documents by type (internal helper)
 */
async function fetchCourseDocumentsByType(courseCode: string, docType: string) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  // Get semester info first to get xqCode
  const semesterUrl = `/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedAPIRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error("Failed to get semester info");
  }

  const xqCode = semesterData.result[0].xqCode;

  // Get course list to find the full course details (prefer cache)
  const { getCourseList } = await import("./course");
  let courseList = await getCourseList();

  const course = courseList.find((c: any) => c.courseNumber === courseCode);
  if (!course) {
    throw new Error(`Course not found: ${courseCode}`);
  }

  // Construct xkhId using course information
  const xkhId = course.facilityId || `${xqCode}-${courseCode}`;

  // Construct the course documents URL with specific docType
  const url = `/coursePlatform/courseResource.shtml?method=stuQueryUploadResourceForCourseList&courseId=${courseCode}&cId=${courseCode}&xkhId=${xkhId}&xqCode=${xqCode}&docType=${docType}&up_id=0&searchName=`;

  const data = await authenticatedAPIRequest(url, true);

  if (data && Array.isArray(data.resList)) {
    // Sanitize all documents
    const sanitizedDocuments = data.resList.map((a: any) =>
      sanitizeCourseDocument(a, convertDocumentType(docType))
    );
    return sanitizedDocuments;
  }

  return []; // No documents
}

/**
 * Fetch all course documents (fetches all document types)
 */
export async function fetchCourseDocuments(courseCode: string) {
  const documentTypes = ["1", "10"]; // Electronic Courseware and Experiment Guide
  const allDocuments: any[] = [];

  for (const docType of documentTypes) {
    try {
      const documents = await fetchCourseDocumentsByType(courseCode, docType);
      allDocuments.push(...documents);
    } catch (error) {
      Logger.error(
        `Failed to fetch documents of type ${docType} for course ${courseCode}`,
        error
      );
      // Continue with other types even if one fails
    }
  }

  return allDocuments;
}

/**
 * Streaming document fetcher that yields results progressively
 */
export async function* fetchDocumentsStreaming(
  courseId?: string,
  onProgress?: (progress: {
    completed: number;
    total: number;
    currentCourse?: string;
  }) => void
) {
  const allDocuments: any[] = [];

  try {
    const documentTypes = [
      { docType: "1", name: "electronicCourseware" },
      { docType: "10", name: "experimentGuide" },
    ];

    if (courseId) {
      // Get documents for specific course
      const totalTasks = documentTypes.length;
      let completed = 0;

      for (const type of documentTypes) {
        if (onProgress) {
          onProgress({ completed, total: totalTasks, currentCourse: courseId });
        }

        try {
          const documents = await fetchCourseDocumentsByType(
            courseId,
            type.docType
          );

          allDocuments.push(...documents);

          // Always yield, even if no documents found
          yield {
            documents,
            courseId,
            courseName: null,
            type: type.name,
          };
        } catch (error) {
          Logger.error(`Failed to get ${type.name} for course`, error);
          // Still yield empty result for this type
          yield {
            documents: [],
            courseId,
            courseName: null,
            type: type.name,
          };
        }

        completed++;
        // Add delay between requests
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 301) + 50)
        );
      }
    } else {
      // Get all documents for all courses
      const { getCourseList } = await import("./course");
      let courseList = await getCourseList();

      Logger.debug(
        `Found ${courseList.length} courses for streaming document fetching`
      );

      // Create batches of course-type combinations
      const batches: { course: any; type: any }[] = [];
      for (const course of courseList) {
        for (const type of documentTypes) {
          batches.push({ course, type });
        }
      }

      const totalTasks = batches.length;
      let completed = 0;

      // Process batches with controlled concurrency
      const batchSize = 4;

      for (let i = 0; i < batches.length; i += batchSize) {
        const currentBatch = batches.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = currentBatch.map(async ({ course, type }) => {
          if (onProgress) {
            onProgress({
              completed,
              total: totalTasks,
              currentCourse: course.name,
            });
          }

          try {
            const documents = await requestQueue.add(() =>
              fetchCourseDocumentsByType(course.courseNumber, type.docType)
            );

            if (documents.length > 0) {
              return {
                documents,
                courseId: course.courseNumber,
                courseName: course.name,
                type: type.name,
                isComplete: false,
              };
            }
          } catch (error) {
            Logger.error(
              `Failed to get ${type.name} for course ${course.name}`,
              error
            );
          }
          return null;
        });

        // Wait for current batch to complete and yield results
        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result && result.documents.length > 0) {
            allDocuments.push(...result.documents);
            yield result;
          }
          completed++;
        }

        // Small delay between batches
        if (i + batchSize < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Indicate completion
      if (onProgress) {
        onProgress({ completed: totalTasks, total: totalTasks });
      }
    }
  } catch (err) {
    Logger.error("Error during document streaming", err);
  }
}
