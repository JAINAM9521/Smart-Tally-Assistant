import { read, save } from "./utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const BACKEND_ERROR_MESSAGE = "Backend server unavailable. Please try again.";

/* =========================================================
   BACKEND CONFIG
========================================================= */

function requireBackendUrl() {
  if (!API_URL) {
    throw new Error(BACKEND_ERROR_MESSAGE);
  }
}

/* =========================================================
   AUTH TOKEN
========================================================= */

function token() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedToken = localStorage.getItem("smartTallyToken");

  if (!storedToken) {
    return null;
  }

  /*
   * Older versions may have stored the JWT
   * through JSON.stringify(), resulting in:
   *
   * "eyJhbGciOi..."
   *
   * We normalize that value so the Authorization
   * header always becomes:
   *
   * Bearer eyJhbGciOi...
   */

  try {
    const parsed = JSON.parse(storedToken);

    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Stored value is already a raw string.
  }

  return storedToken.replace(/^"(.*)"$/, "$1");
}

/* =========================================================
   RESPONSE NORMALIZATION
========================================================= */

function normalizeResponse(data) {
  if (
    data &&
    typeof data === "object" &&
    data.data &&
    typeof data.data === "object"
  ) {
    return {
      ...data.data,
      ...data,
    };
  }

  return data || {};
}

function getUserFromResponse(data) {
  const normalized = normalizeResponse(data);

  return normalized.user || normalized.currentUser || null;
}

function getTokenFromResponse(data) {
  const normalized = normalizeResponse(data);

  return normalized.token || normalized.accessToken || normalized.jwt || null;
}

/* =========================================================
   HTTP REQUEST
========================================================= */

async function request(path, options = {}) {
  requireBackendUrl();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : {
          "Content-Type": "application/json",
        }),
    ...(options.headers || {}),
  };

  const authToken = token();

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`${BACKEND_ERROR_MESSAGE} ${error?.message || ""}`.trim());
  }

  const rawData = await response.json().catch(() => ({}));

  const data = normalizeResponse(rawData);

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("smartTallyToken");

      localStorage.removeItem("currentUser");
    }

    throw new Error(data.message || data.error || "Backend request failed.");
  }

  return data;
}

/* =========================================================
   AUTHENTICATION
========================================================= */

export async function loginUser(email, password) {
  const response = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const authToken = getTokenFromResponse(response);

  const user = getUserFromResponse(response);

  if (!authToken) {
    throw new Error(
      "Login succeeded, but the backend did not return an authentication token.",
    );
  }

  if (!user) {
    throw new Error(
      "Login succeeded, but the backend did not return user information.",
    );
  }

  /*
   * IMPORTANT:
   * Store JWT directly using localStorage.setItem().
   * This prevents JSON-stringified quotes from being
   * added around the JWT.
   */
  localStorage.setItem("smartTallyToken", authToken);

  save("currentUser", user);

  return user;
}

export async function registerUser(data) {
  const response = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

  return getUserFromResponse(response) || response.user || response;
}

export async function getCurrentUser() {
  const authToken = token();

  if (!authToken) {
    throw new Error("Authentication token is missing.");
  }

  const response = await request("/auth/me");

  const user = getUserFromResponse(response);

  if (!user) {
    throw new Error("Authenticated user was not returned by the backend.");
  }

  save("currentUser", user);

  return user;
}

export async function verifyEmail(token) {
  if (!token) {
    throw new Error("Verification token is required.");
  }
  return request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email) {
  if (!email) {
    throw new Error("Email is required.");
  }
  return request("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/* =========================================================
   PASSWORD RESET
========================================================= */

export async function requestPasswordReset(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}

export async function resetPassword(payload) {
  const body =
    typeof payload === "object"
      ? payload
      : {
          email: payload,
        };

  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* =========================================================
   EXCEL UPLOAD
========================================================= */

export async function uploadExcel(file, voucherType) {
  if (typeof File !== "undefined" && !(file instanceof File)) {
    throw new Error("Please select a valid Excel file.");
  }

  const body = new FormData();

  body.append("file", file);

  body.append("voucherType", voucherType || read("selectedVoucher", "Sales"));

  const response = await request("/uploads", {
    method: "POST",
    body,
  });

  const upload = response.upload || response;

  if (!upload?._id) {
    throw new Error("Backend did not return a valid upload ID.");
  }

  save("backendUploadId", upload._id);

  return upload;
}

export async function getUploadPreview(uploadId, page = 1, limit = 50) {
  return request(`/uploads/${uploadId}/preview?page=${page}&limit=${limit}`);
}

/* =========================================================
   TEMPLATES
========================================================= */

export async function getTemplate(voucherType) {
  return request(`/templates/${encodeURIComponent(voucherType)}`);
}

export async function downloadTemplate(voucherType) {
  requireBackendUrl();

  const authToken = token();

  const response = await fetch(
    `${API_URL}/templates/${encodeURIComponent(voucherType)}/download`,
    {
      headers: authToken
        ? {
            Authorization: `Bearer ${authToken}`,
          }
        : {},
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(data.message || "Unable to download template.");
  }

  const blob = await response.blob();

  const disposition = response.headers.get("content-disposition") || "";

  const match = disposition.match(/filename="?([^"]+)"?/i);

  const filename =
    match?.[1] ||
    `${String(voucherType)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")}_template.csv`;

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  return filename;
}

/* =========================================================
   VALIDATION
========================================================= */

export async function validateExcel(uploadId) {
  const id = uploadId || read("backendUploadId", null);

  if (!id) {
    throw new Error("No uploaded workbook is available for validation.");
  }

  const response = await request(`/validation/${id}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const validation = response.validation || response;

  const validationId =
    response.validationId || validation.validationId || validation._id || null;

  if (validationId) {
    save("backendValidationId", validationId);
  }

  return {
    ...response,
    ...validation,
    validationId,
  };
}

export async function autoFixErrors() {
  const id = read("backendValidationId", null);

  if (!id) {
    throw new Error("No validation run is available.");
  }

  return request(`/validation/${id}/auto-fix`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fixIssue(issueId) {
  const validationId = read("backendValidationId", null);

  if (!validationId) {
    throw new Error("No validation run is available.");
  }

  return request(`/validation/${validationId}/issues/${issueId}/fix`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function applyRecommendation(issueId) {
  const validationId = read("backendValidationId", null);

  if (!validationId) {
    throw new Error("No validation run is available.");
  }

  return request(`/validation/${validationId}/issues/${issueId}/apply`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function ignoreIssue(issueId) {
  const validationId = read("backendValidationId", null);

  if (!validationId) {
    throw new Error("No validation run is available.");
  }

  return request(`/validation/${validationId}/issues/${issueId}/ignore`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function revalidateData() {
  const validationId = read("backendValidationId", null);

  if (!validationId) {
    throw new Error("No validation run is available.");
  }

  return request(`/validation/${validationId}/revalidate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/* =========================================================
   XML
========================================================= */

export async function generateXML() {
  const validationId = read("backendValidationId", null);

  if (!validationId) {
    throw new Error("No validation run is available.");
  }

  const response = await request(`/xml/generate/${validationId}`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const xml = response.xml || response;

  if (!xml?._id) {
    throw new Error("Backend did not return a valid XML file.");
  }

  save("backendXmlId", xml._id);

  return xml;
}

export async function getXML(id) {
  if (!id) {
    throw new Error("XML file ID is required.");
  }

  return request(`/xml/${id}`);
}

export async function downloadXML(id) {
  requireBackendUrl();

  if (!id) {
    throw new Error("XML file ID is required.");
  }

  const authToken = token();

  const response = await fetch(`${API_URL}/xml/${id}/download`, {
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : {},
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(data.message || "Unable to download XML.");
  }

  const blob = await response.blob();

  const disposition = response.headers.get("content-disposition") || "";

  const match = disposition.match(/filename="?([^"]+)"?/i);

  const filename = match?.[1] || "tally_import.xml";

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  return filename;
}

/* =========================================================
   HISTORY / REPORTS / ANALYTICS
========================================================= */

export async function getUploadHistory(params = "") {
  return request(`/uploads${params ? `?${params}` : ""}`);
}

export async function getValidation(id) {
  if (!id) {
    throw new Error("Validation ID is required.");
  }
  return request(`/validation/${id}`);
}

export async function getValidationReports(params = "") {
  return request(`/reports/validation${params ? `?${params}` : ""}`);
}

export async function getValidationReport(id) {
  if (!id) {
    throw new Error("Report ID is required.");
  }
  return request(`/reports/validation/${id}`);
}

export async function getXMLFiles(params = "") {
  return request(`/xml${params ? `?${params}` : ""}`);
}

export async function getAnalyticsDashboard() {
  return request("/analytics/dashboard");
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

export async function getNotifications() {
  return request("/notifications");
}

export async function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

/* =========================================================
   PROFILE
========================================================= */

export async function getProfile() {
  return request("/user/profile");
}

export async function updateProfile(data) {
  return request("/user/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/* =========================================================
   CHATBOT
========================================================= */

export async function sendChatbotMessage(message, context = {}) {
  return request("/chatbot/message", {
    method: "POST",
    body: JSON.stringify({
      message,
      context,
    }),
  });
}

/* =========================================================
   VALIDATION SCORE
========================================================= */

export function getValidationScore(issues = []) {
  const blocking = issues.filter(
    (issue) =>
      issue.status === "pending" &&
      String(issue.severity).toLowerCase() === "error",
  ).length;

  return blocking === 0 ? 100 : Math.max(0, 100 - blocking);
}
