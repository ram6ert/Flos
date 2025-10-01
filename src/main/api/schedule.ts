import { API_CONFIG, courseAPI } from "../constants";
import { currentSession, captchaSession, updateSessionCookies } from "../auth";
import { getCachedData, setCachedData, SCHEDULE_CACHE_DURATION } from "../cache";
import { Logger } from "../logger";
import { ScheduleData } from "../../shared/types";
import * as iconv from "iconv-lite";
import { ScheduleParser } from "../schedule-parser";

/**
 * Fetch and parse schedule data
 */
export async function fetchScheduleData(
  forceRefresh: boolean = false
): Promise<ScheduleData> {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const sessionId = "2021112401";
  const cacheKey = `schedule_${sessionId}`;

  // Check cache first unless force refresh is requested
  if (!forceRefresh) {
    const cachedData = getCachedData(cacheKey, SCHEDULE_CACHE_DURATION);
    if (cachedData) {
      Logger.event("Using cached schedule data");
      return cachedData;
    }
  }

  const url = `/rp/common/myTimeTableDetail.shtml?method=skipIndex&sessionId=${sessionId}`;

  try {
    const response = await courseAPI.get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Cookie: captchaSession ? captchaSession.cookies.join("; ") : "",
        Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
        "User-Agent": API_CONFIG.HEADERS["User-Agent"],
      },
      responseType: "arraybuffer", // Get raw bytes for GBK decoding
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      updateSessionCookies(response);

      // Decode GBK content to UTF-8
      const decodedHtml = iconv.decode(Buffer.from(response.data), "gbk");

      // Use parser to transform HTML into structured data
      const scheduleData = await ScheduleParser.parseAndTransform(decodedHtml);

      // Cache the result with custom TTL
      setCachedData(cacheKey, scheduleData, SCHEDULE_CACHE_DURATION);

      Logger.event(
        `Schedule data transformed: ${scheduleData.statistics.totalCourses} courses, ${scheduleData.weeks[0]?.metadata.conflicts.length || 0} conflicts`
      );
      return scheduleData;
    }

    throw new Error(`Request failed with status: ${response.status}`);
  } catch (error) {
    Logger.error("Failed to fetch schedule", error);
    throw error;
  }
}
