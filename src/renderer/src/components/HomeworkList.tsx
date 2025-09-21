import React, { useEffect, useState } from 'react';

interface Homework {
  id: string;
  title: string;
  end_time: string;
  subStatus: string;
  courseName?: string;
  homeworkType?: string;
  stu_score?: string | number;
}

interface HomeworkResponse {
  data: Homework[];
  fromCache: boolean;
  age: number;
}

const HomeworkList: React.FC = () => {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");
  const [cacheInfo, setCacheInfo] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchHomework();
  }, []);

  useEffect(() => {
    // Listen for cache updates
    const handleCacheUpdate = (event: any, payload: { key: string; data: any }) => {
      if (payload.key === 'all_homework' || payload.key.startsWith('homework_')) {
        setHomework(payload.data || []);
        setCacheInfo("Data updated in background");
      }
    };

    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);

    return () => {
      window.electronAPI.removeAllListeners?.('cache-updated');
    };
  }, []);

  const fetchHomework = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError("");
      const response: HomeworkResponse = forceRefresh
        ? await window.electronAPI.refreshHomework()
        : await window.electronAPI.getHomework();
      setHomework(response.data);

      const ageMinutes = Math.floor(response.age / (1000 * 60));
      setCacheInfo(
        response.fromCache
          ? `Showing cached data (${ageMinutes} minutes old)`
          : "Showing fresh data"
      );
    } catch (error) {
      console.error("Failed to fetch homework:", error);
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('502')) {
          setError("Please log in to view homework data. Authentication required.");
        } else if (error.message.includes('Session expired')) {
          setError("Your session has expired. Please log in again.");
        } else {
          setError("Failed to fetch homework data. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred while fetching homework.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (hw: Homework) => {
    const isGraded = hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩';
    const isSubmitted = hw.subStatus === '已提交';

    if (isGraded) return "#28a745"; // green
    if (isSubmitted) return "#007bff"; // blue
    return "#dc3545"; // red for pending
  };

  const getStatusText = (hw: Homework) => {
    const isGraded = hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩';
    const isSubmitted = hw.subStatus === '已提交';

    if (isGraded) return "Graded";
    if (isSubmitted) return "Submitted";
    return "Pending";
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const isOverdue = (hw: Homework) => {
    const deadline = new Date(hw.end_time);
    const now = new Date();
    return deadline < now && hw.subStatus !== '已提交';
  };

  const filteredHomework = homework.filter(hw => {
    const isGraded = hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩';
    const isSubmitted = hw.subStatus === '已提交';

    switch (filter) {
      case "pending":
        return !isSubmitted && !isGraded;
      case "submitted":
        return isSubmitted && !isGraded;
      case "graded":
        return isGraded;
      default:
        return true;
    }
  }).sort((a, b) => {
    // Sort by due date (earliest first)
    const dateA = new Date(a.end_time);
    const dateB = new Date(b.end_time);

    // Put overdue items at the top, then sort by due date
    const nowTime = new Date().getTime();
    const isOverdueA = dateA.getTime() < nowTime && a.subStatus !== '已提交';
    const isOverdueB = dateB.getTime() < nowTime && b.subStatus !== '已提交';

    // If one is overdue and the other isn't, overdue comes first
    if (isOverdueA && !isOverdueB) return -1;
    if (!isOverdueA && isOverdueB) return 1;

    // Otherwise sort by due date (earliest first)
    return dateA.getTime() - dateB.getTime();
  });

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading homework...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{
          padding: "16px",
          backgroundColor: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: "4px",
          color: "#721c24",
          marginBottom: "20px"
        }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Unable to Load Homework</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
        <button
          onClick={() => fetchHomework(true)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Homework ({filteredHomework.length})</h2>
        <button
          onClick={() => fetchHomework(true)}
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {cacheInfo && (
        <div style={{
          padding: "8px 12px",
          backgroundColor: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          marginBottom: "15px",
          fontSize: "14px",
          color: "#6c757d"
        }}>
          {cacheInfo}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        {["all", "pending", "submitted", "graded"].map(filterType => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType as any)}
            style={{
              padding: "6px 12px",
              marginRight: "8px",
              backgroundColor: filter === filterType ? "#007bff" : "#f8f9fa",
              color: filter === filterType ? "white" : "#495057",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {filteredHomework.length === 0 ? (
        <p>No homework found for the selected filter.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredHomework.map((hw) => (
            <div
              key={hw.id}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                borderRadius: "5px",
                backgroundColor: isOverdue(hw) ? "#f8d7da" : "#ffffff",
                borderLeftWidth: "4px",
                borderLeftColor: getStatusColor(hw),
              }}
            >
              <h3 style={{ margin: "0 0 8px 0" }}>{hw.title}</h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "14px" }}>
                <p><strong>Course:</strong> {hw.courseName || "Unknown"}</p>
                <p><strong>Type:</strong> {hw.homeworkType || "Assignment"}</p>
                <p><strong>Due:</strong> {formatDeadline(hw.end_time)}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span style={{ color: getStatusColor(hw) }}>
                    {getStatusText(hw)}
                    {isOverdue(hw) && " (Overdue)"}
                  </span>
                </p>
              </div>

              {hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩' && (
                <p style={{ marginTop: "8px", fontSize: "14px" }}>
                  <strong>Score:</strong> {hw.stu_score}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeworkList;