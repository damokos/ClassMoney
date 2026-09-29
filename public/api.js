async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
        data?.error ||
        "API request failed.",
    );

    error.status = response.status;
    error.code = data?.error?.code;

    throw error;
  }

  return data;
}

export async function getMe() {
  return request("/api/me");
}

export async function getInstitutionName() {
  return request("/api/settings/institution-name");
}

export async function saveInstitutionName(name) {
  return request("/api/settings/institution-name", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function getUsers(includeInactive = true) {
  return request(`/api/users${includeInactive ? "?includeInactive=true" : ""}`);
}

export async function createUser(email) {
  return request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function updateUser(id, input) {
  return request(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export async function addUserRole(id, role, classId = null) {
  return request(`/api/users/${id}/roles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, classId }) });
}

export async function removeUserRole(id, role, classId = null) {
  return request(`/api/users/${id}/roles`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, classId }) });
}

export async function updateUserChildren(id, childIds) {
  return request(`/api/users/${id}/children`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childIds }) });
}

export async function getNotifications() {
  return request("/api/notifications");
}

export async function getNotificationSettings() {
  return request("/api/notifications/preferences");
}

export async function saveNotificationSettings(settings) {
  return request("/api/notifications/preferences", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
  });
}

export async function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  return request("/api/notifications/read-all", { method: "POST" });
}

export async function getClasses(
  includeArchived = false,
) {
  const query = includeArchived
    ? "?includeArchived=true"
    : "";

  return request(`/api/classes${query}`);
}

export async function createClass(input) {
  return request("/api/classes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updateClass(id, input) {
  return request(`/api/classes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function archiveClass(id) {
  return request(`/api/classes/${id}`, {
    method: "POST",
  });
}

export async function getChildren(
  classId,
  includeInactive = false,
) {
  const query = includeInactive
    ? "?includeInactive=true"
    : "";

  return request(
    `/api/classes/${classId}/children${query}`,
  );
}

export async function createChild(classId, input) {
  return request(`/api/classes/${classId}/children`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updateChild(
  classId,
  childId,
  input,
) {
  return request(
    `/api/classes/${classId}/children/${childId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function getFinances(
  classId,
  includeCancelled = false,
) {
  const query = includeCancelled
    ? "?includeCancelled=true"
    : "";

  return request(
    `/api/classes/${classId}/finances${query}`,
  );
}

export async function getMyFinances() {
  return request("/api/my/finances");
}

export async function createCharge(
  classId,
  input,
) {
  return request(`/api/classes/${classId}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function payCharge(id) {
  return request(`/api/charges/${id}/pay`, {
    method: "POST",
  });
}

export async function cancelCharge(id) {
  return request(`/api/charges/${id}/cancel`, {
    method: "POST",
  });
}

export async function createExpense(
  classId,
  input,
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(input)) {
    body.append(key, value);
  }
  return request(`/api/classes/${classId}/expenses`, {
    method: "POST",
    body,
  });
}

export async function payExpense(id) {
  return request(`/api/expenses/${id}/pay`, {
    method: "POST",
  });
}

export async function cancelExpense(id) {
  return request(`/api/expenses/${id}/cancel`, {
    method: "POST",
  });
}

export async function createFinancialTransaction(
  classId,
  input,
) {
  return request(
    `/api/classes/${classId}/financial-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function payFinancialTransaction(id) {
  return request(
    `/api/financial-transactions/${id}/pay`,
    {
      method: "POST",
    },
  );
}

export async function cancelFinancialTransaction(id) {
  return request(
    `/api/financial-transactions/${id}/cancel`,
    {
      method: "POST",
    },
  );
}
