import axios from "axios";
import { showSessionExpiredAlert, clearAuthStorage } from "./SessionExpired";
import { getAuthToken, setAuthToken, TAB_SESSION_HEADER, getTabSessionId } from "../utils/authSession";

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 30000,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.request.use(
  (config) => {
    // authToken lives in THIS tab's sessionStorage (see utils/authSession.js) —
    // never localStorage, which is shared by every tab of the origin and was
    // the root cause of one tab's requests going out with another tab's
    // identity after either tab logged in/out or refreshed.
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Scopes the backend's refresh-token cookie to this tab (see
    // AuthController.java) so a 401-triggered silent refresh below can only
    // ever rotate/consume THIS tab's own refresh token, never one that a
    // different tab's login most recently installed for the origin. Only
    // /auth/* reads this header — scoped to that prefix rather than sent on
    // every request so the hundreds of /api/* calls don't pick up an extra
    // CORS-preflight header they have no use for.
    if (config.url && config.url.includes("/auth/")) {
      config.headers = config.headers || {};
      config.headers[TAB_SESSION_HEADER] = getTabSessionId();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // A 401 from the login call itself means wrong credentials, not an expired
    // session — there is no session yet to refresh. Let the login page show its
    // own inline "Invalid username or password" instead of the refresh attempt
    // + "Session Expired" popup.
    const isLoginRequest =
      typeof originalRequest?.url === "string" &&
      originalRequest.url.split("?")[0].endsWith("/auth/login");

    if (
      !isLoginRequest &&
      error.response &&
      (error.response.status === 401 || error.response.status === 403) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_BASE_URL}/auth/refresh-token`,
          {},
          {
            withCredentials: true,
            // Raw axios (not axiosInstance), so the request interceptor
            // above never runs for this call — the tab-session header has
            // to be set explicitly here too, or the backend falls back to
            // the unscoped legacy cookie and this tab's refresh could pick
            // up whichever tab logged in most recently instead of its own.
            headers: { [TAB_SESSION_HEADER]: getTabSessionId() },
          }
        );

        const newAccessToken = response.data.accessToken;
        setAuthToken(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthStorage();
        showSessionExpiredAlert();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
