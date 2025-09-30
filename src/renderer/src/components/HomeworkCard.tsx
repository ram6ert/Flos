import { t } from "i18next";
import { Card, Button, FileInput, cn } from "./common/StyledComponents";
import {
  Homework,
  HomeworkAttachment,
  HomeworkDetails,
} from "../../../shared/types";
import { useState } from "react";

const formatFileSize = (size: number | string) => {
  // Handle if size is a string (e.g., "2.5MB" or "2.5")
  if (typeof size === "string") {
    // If it already contains "MB" or "KB", return as is
    if (size.includes("MB") || size.includes("KB") || size.includes("GB")) {
      return size;
    }
    // Try to parse as a number
    size = parseFloat(size);
  }
  
  // If size is already in MB (< 1024, assuming reasonable file sizes)
  // This handles the case where server returns MB
  if (size < 1024 && size >= 0.001) {
    if (size < 1) {
      return `${(size * 1024).toFixed(0)} KB`;
    }
    return `${size.toFixed(2)} MB`;
  }
  
  // Otherwise assume it's in bytes
  if (size === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return Math.round((size / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

interface HomeworkCardProps {
  homework: Homework;
  refreshHomework: () => Promise<void>;
}

const HomeworkCard: React.FC<HomeworkCardProps> = ({
  homework,
  refreshHomework,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<HomeworkDetails | null>(null);
  const [submissionText, setSubmissionText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const getRemainingTime = (hw: Homework) => {
    const now = new Date();
    const timeDiff = new Date(hw.dueDate).getTime() - now.getTime();

    if (hw.submissionStatus === "submitted") {
      return { text: t("submitted"), color: "#28a745", isOverdue: false };
    }

    if (timeDiff < 0) {
      const overdueDays = Math.floor(
        Math.abs(timeDiff) / (1000 * 60 * 60 * 24)
      );
      const overdueHours = Math.floor(
        (Math.abs(timeDiff) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      if (overdueDays > 0) {
        return {
          text: t("overdueDaysHours", {
            days: overdueDays,
            hours: overdueHours,
          }),
          color: "#dc3545",
          isOverdue: true,
        };
      } else {
        return {
          text: t("overdueHours", { hours: overdueHours }),
          color: "#dc3545",
          isOverdue: true,
        };
      }
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        text: t("daysHoursLeft", { days, hours }),
        color: "#007bff",
        isOverdue: false,
      };
    } else if (hours > 0) {
      return {
        text: t("hoursMinutesLeft", { hours, minutes }),
        color: "#ffc107",
        isOverdue: false,
      };
    } else {
      return {
        text: t("minutesLeft", { minutes }),
        color: "#dc3545",
        isOverdue: false,
      };
    }
  };

  const formatScore = (score: number | null) => {
    if (score === null) {
      return t("gradeNotPublished");
    }
    return score.toString();
  };

  const formatDeadline = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const getStatusColor = (hw: Homework) => {
    if (hw.submissionStatus === "graded") return "#28a745"; // green
    if (hw.submissionStatus === "submitted") return "#007bff"; // blue
    return "#dc3545"; // red for pending
  };

  const sanitizeContent = (content: string) => {
    if (!content) return "";

    let sanitized = content;

    // Remove dangerous elements first
    sanitized = sanitized
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<link[^>]*>/gi, "")
      .replace(/<meta[^>]*>/gi, "");

    // Replace img tags with placeholder text
    sanitized = sanitized.replace(
      /<img[^>]*>/gi,
      "**[Image removed for security]**"
    );

    // Preserve formatting by converting common HTML tags to text equivalents
    sanitized = sanitized
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      .replace(/<h[1-6][^>]*>/gi, "\n**")
      .replace(/<\/h[1-6]>/gi, "**\n")
      .replace(/<strong[^>]*>/gi, "**")
      .replace(/<\/strong>/gi, "**")
      .replace(/<b[^>]*>/gi, "**")
      .replace(/<\/b>/gi, "**")
      .replace(/<em[^>]*>/gi, "*")
      .replace(/<\/em>/gi, "*")
      .replace(/<i[^>]*>/gi, "*")
      .replace(/<\/i>/gi, "*")
      .replace(/<ul[^>]*>/gi, "\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<ol[^>]*>/gi, "\n")
      .replace(/<\/ol>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n");

    // Remove any remaining HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    sanitized = sanitized
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, "...")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–");

    // Clean up excessive whitespace
    sanitized = sanitized
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    return sanitized;
  };

  const renderContentWithBold = (content: string) => {
    // Split by **text** patterns and render bold text
    // whitespace-pre-wrap CSS class handles newlines automatically
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={index} className="text-red-600">
            {boldText}
          </strong>
        );
      }
      return part;
    });
  };

  const translateStatus = (
    status: "submitted" | "not_submitted" | "graded"
  ) => {
    switch (status) {
      case "submitted":
        return t("submitted");
      case "not_submitted":
        return t("notSubmitted");
      case "graded":
        return t("graded");
      default:
        return status;
    }
  };

  const getHomeworkTypeText = (
    type: "homework" | "report" | "experiment" | "quiz" | "assessment"
  ) => {
    switch (type) {
      case "homework":
        return t("normalHomework");
      case "report":
        return t("courseReport");
      case "experiment":
        return t("experimentHomework");
      case "quiz":
        return t("regularQuiz");
      case "assessment":
        return t("finalAssessment");
      default:
        return t("unknownType");
    }
  };

  const fetchHomeworkDetails = async (
    homeworkId: number,
    courseId: number,
    teacherId?: string
  ) => {
    try {
      const response = await window.electronAPI.getHomeworkDetails(
        homeworkId.toString(),
        courseId.toString(),
        teacherId || "0" // Default teacher ID if not available
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch homework details:", error);
    }
  };

  const handleExpandDetails = async () => {
    if (expanded) {
      // Collapse details
      setExpanded(false);
      return;
    }

    // Expand details
    setExpanded(true);

    // If details already loaded, no need to fetch again
    if (details) return;

    setDetailsLoading(true);
    const homeworkDetails = await fetchHomeworkDetails(
      homework.id,
      homework.courseId
    );

    // If homework is submitted, fetch "My Homework" attachments
    if (
      homework.submissionStatus === "submitted" &&
      homework.submissionId &&
      homework.userId
    ) {
      try {
        const downloadUrlsResponse =
          await window.electronAPI.getHomeworkDownloadUrls(
            homework.id.toString(),
            homework.submissionId,
            homework.userId,
            homework.maxScore.toString()
          );

        if (
          downloadUrlsResponse.success &&
          downloadUrlsResponse.data.length > 0
        ) {
          // Add "My Homework" attachments to the existing attachments
          // Fetch file sizes for each submitted homework file
          const myHomeworkAttachmentsPromises = downloadUrlsResponse.data.map(
            async (file) => {
              let fileSize = 0;
              try {
                // Get file size via HEAD request (without downloading)
                const sizeResult = await window.electronAPI.getHomeworkFileSize(
                  file.url
                );
                if (sizeResult.success && sizeResult.fileSize) {
                  fileSize = sizeResult.fileSize;
                }
              } catch (error) {
                console.error("Failed to get file size for:", file.fileName);
              }
              
              return {
                id: parseInt(file.id) || 0,
                url: file.url,
                fileName: file.fileName,
                convertUrl: "",
                fileSize: fileSize,
                type: "my_homework" as const,
              };
            }
          );

          const myHomeworkAttachments = await Promise.all(myHomeworkAttachmentsPromises);

          if (homeworkDetails && homeworkDetails.attachments) {
            homeworkDetails.attachments.push(...myHomeworkAttachments);
          } else if (homeworkDetails) {
            homeworkDetails.attachments = myHomeworkAttachments;
          }
        }
      } catch (error) {
        console.error("Failed to fetch my homework files:", error);
      }
    }

    setDetails(homeworkDetails);
    setDetailsLoading(false);
  };

  const handleHomeworkSubmission = async () => {
    if (submitting) return; // Prevent duplicate submissions
    setSubmitting(true);
    try {
      let files: { filePath: string; fileName: string }[] = [];
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles?.length; ++i) {
          files.push({
            filePath: selectedFiles[i].path,
            fileName: selectedFiles[i].name,
          });
        }
      }
      await window.electronAPI.submitHomework({
        homeworkId: homework.id.toString(),
        courseId: homework.courseId.toString(),
        content: submissionText,
        files,
      });
      // Refresh homework after submission
      await refreshHomework();
      // Clear input fields
      setSubmissionText("");
      setSelectedFiles(null);
    } catch (error) {
      console.error("Failed to submit homework:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = (hw: Homework) => {
    const now = new Date();
    return new Date(hw.dueDate) < now;
  };

  const remainingTime = getRemainingTime(homework);
  const statusColor = getStatusColor(homework);

  return (
    <Card
      padding="lg"
      className={cn("border-l-4", remainingTime.isOverdue && "bg-red-50")}
      style={{ borderLeftColor: statusColor }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="m-0 flex-1 text-lg font-semibold text-gray-900">
          {homework.title}
        </h3>
        <div
          className="font-bold text-sm text-right min-w-30"
          style={{ color: remainingTime.color }}
        >
          {remainingTime.text}
        </div>
      </div>

      {sanitizeContent(homework.content) && (
        <div className="mb-3 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
          {renderContentWithBold(sanitizeContent(homework.content))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <p className="m-0">
          <strong>{t("course")}:</strong> {homework.courseName}
        </p>
        <p className="m-0">
          <strong>{t("maxScore")}:</strong> {homework.maxScore}
        </p>
        <p className="m-0">
          <strong>{t("due")}:</strong> {formatDeadline(homework.dueDate)}
        </p>
        <p className="m-0">
          <strong>{t("status")}:</strong>{" "}
          <span style={{ color: getStatusColor(homework) }}>
            {translateStatus(homework.submissionStatus)}
          </span>
        </p>
        <p className="m-0">
          <strong>{t("type")}:</strong> {getHomeworkTypeText(homework.type)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
        <p className="m-0">
          <strong>{t("submitted")}:</strong> {homework.submittedCount}/
          {homework.totalStudents} {t("students")}
        </p>
        <p className="m-0">
          <strong>{t("grade")}:</strong> {formatScore(homework.studentScore)}
        </p>
      </div>

      {homework.submitDate && (
        <p className="mt-2 text-xs text-gray-500">
          <strong>{t("submittedAt")}:</strong>{" "}
          {formatDeadline(homework.submitDate)}
        </p>
      )}

      {/* View Details Button */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <Button
          onClick={handleExpandDetails}
          disabled={detailsLoading && expanded}
          variant={expanded ? "danger" : "primary"}
          size="sm"
        >
          {detailsLoading && expanded
            ? t("loading")
            : expanded
              ? t("hideDetails")
              : t("viewDetails")}
        </Button>
      </div>

      {/* Expanded Details View */}
      {expanded && details && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h4 className="mb-3 text-gray-700">{t("homeworkDetails")}</h4>

          {(() => {
            return (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <p className="m-0">
                    <strong>{t("created")}:</strong>{" "}
                    {new Date(details.createdDate).toLocaleString()}
                  </p>
                  <p className="m-0">
                    <strong>{t("openDate")}:</strong>{" "}
                    {new Date(details.openDate).toLocaleString()}
                  </p>
                  {details.isAnswerPublished && (
                    <p className="m-0">
                      <strong>{t("answer")}:</strong> {details.referenceAnswer}
                    </p>
                  )}
                  <p className="m-0">
                    <strong>{t("repeatAllowed")}:</strong>{" "}
                    {details.isRepeatAllowed ? t("yes") : t("no")}
                  </p>
                </div>

                {/* Detailed Content */}
                {details.content && sanitizeContent(details.content) && (
                  <div className="mb-4">
                    <h5 className="mb-2 text-gray-700">
                      {t("fullDescription")}:
                    </h5>
                    <div className="p-3 bg-white rounded border border-gray-300 text-sm leading-6 whitespace-pre-wrap">
                      {renderContentWithBold(sanitizeContent(details.content))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {(details.attachments && details.attachments.length > 0) ||
                details.url ? (
                  <div className="mb-4">
                    <h5 className="mb-3 text-gray-700">{t("attachments")}:</h5>
                    <div className="flex flex-col gap-2">
                      {details.attachments && details.attachments.length > 0
                        ? details.attachments.map((attachment, index) => (
                            <AttachmentCard
                              attachment={attachment}
                              key={`${attachment.id}-${index}`}
                            />
                          ))
                        : null}
                    </div>
                  </div>
                ) : null}

                {/* Homework Submission Section */}
                {(() => {
                  const canSubmit =
                    !isOverdue(homework) &&
                    (homework.submissionStatus === "not_submitted" ||
                      (homework.submissionStatus === "submitted" &&
                        details?.isRepeatAllowed));
                  if (!canSubmit) return null;
                  return (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h5 className="mb-3 text-blue-800 font-semibold">
                        {homework.submissionStatus === "submitted"
                          ? t("submitHomework")
                          : t("submitHomework")}
                      </h5>

                      {/* Text Content Input */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("submissionContent")} ({t("optional")})
                        </label>
                        <textarea
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          placeholder={t("enterSubmissionText")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                          rows={4}
                          disabled={submitting}
                        />
                      </div>

                      {/* File Upload */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("attachFiles")} ({t("optional")})
                        </label>
                        <FileInput
                          multiple
                          onChange={(e) => setSelectedFiles(e.target.files)}
                          disabled={submitting}
                        />
                        {selectedFiles && (
                          <div className="mt-2 text-sm text-gray-600">
                            {t("selectedFiles", {
                              count: selectedFiles.length,
                            })}
                            :
                            <ul className="list-disc list-inside mt-1">
                              {Array.from(selectedFiles).map((file, index) => (
                                <li key={index} className="truncate">
                                  {file.name} ({formatFileSize(file.size)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleHomeworkSubmission}
                          disabled={
                            submitting ||
                            (!submissionText.trim() && !selectedFiles)
                          }
                          variant="primary"
                          size="md"
                        >
                          {submitting
                            ? t("submitting")
                            : homework.submissionStatus === "submitted"
                              ? t("submitHomework")
                              : t("submitHomework")}
                        </Button>

                        {submitting && (
                          <div className="text-sm text-blue-600 flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            {t("submittingHomework")}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        {t("submissionNote")}
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>
      )}
    </Card>
  );
};

interface AttachmentCardProps {
  attachment: HomeworkAttachment;
}

const AttachmentCard: React.FC<AttachmentCardProps> = ({ attachment }) => {
  const [downloading, setDownloading] = useState<boolean>(false);

  const getFileExtension = (url: string): string => {
    const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
    return match ? match[1] : "";
  };

  const ensureFileExtension = (fileName: string, url: string): string => {
    // Check if fileName already has an extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(fileName);
    if (hasExtension) {
      return fileName;
    }
    
    // Try to get extension from URL
    const extension = getFileExtension(url);
    if (extension) {
      return `${fileName}.${extension}`;
    }
    
    return fileName;
  };

  const handleDownloadAttachment = async (attachment: HomeworkAttachment) => {
    setDownloading(true);
    try {
      // Ensure fileName has proper extension
      const fileName = ensureFileExtension(attachment.fileName, attachment.url);
      
      let result;

      if (attachment.type === "my_homework") {
        // Use the new API for submitted homework files
        result = await window.electronAPI.downloadSubmittedHomework(
          attachment.url,
          fileName,
          attachment.id.toString()
        );
      } else {
        // Use existing API for regular attachments
        result = await window.electronAPI.downloadHomeworkAttachment(
          attachment.url,
          fileName
        );
      }

      if (result.savedToFile) {
        // Large file saved directly to disk
        alert(`文件下载成功: ${result.filePath}`);
      } else if (result.data) {
        // Small file - create download link
        const blob = new Blob(
          [Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))],
          {
            type: result.contentType,
          }
        );
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || `download_${attachment.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (!result.success) {
        alert(`下载失败: ${result.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("下载附件失败");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="p-3 bg-white rounded border border-gray-300 flex items-center justify-between">
      <div>
        <div className="font-bold mb-1">
          📎 {attachment.fileName}
          {attachment.type && (
            <span
              className={cn(
                "ml-2 text-xs px-1.5 py-0.5 text-white rounded",
                attachment.type === "answer"
                  ? "bg-cyan-600"
                  : attachment.type === "my_homework"
                    ? "bg-green-600"
                    : "bg-gray-600"
              )}
            >
              {attachment.type === "answer"
                ? t("answer")
                : attachment.type === "my_homework"
                  ? t("myHomework")
                  : t("homework")}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {t("size")}: {formatFileSize(attachment.fileSize)}
        </div>
      </div>
      <Button
        onClick={() => handleDownloadAttachment(attachment)}
        disabled={downloading}
        variant="success"
        size="sm"
        className="text-xs"
      >
        {downloading ? t("downloading") : t("download")}
      </Button>
    </div>
  );
};
export default HomeworkCard;
