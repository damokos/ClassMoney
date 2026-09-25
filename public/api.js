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

export async function getClasses() {
  return request("/api/classes");
}
