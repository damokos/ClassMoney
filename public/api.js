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
