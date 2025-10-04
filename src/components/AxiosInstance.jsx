import axios from "axios";
import { showSessionExpiredAlert } from "./SessionExpired";


const axiosInstance = axios.create({
  baseURL: "http://localhost:8081",
  timeout: 10000,
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
    const token = localStorage.getItem("authToken");
    if (token) {
      
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("No token found in localStorage");
    }
    
    // if (!token) {
    //   showSessionExpiredAlert();
    //   return Promise.reject(new Error("No token found. Redirecting to login..."));
    // }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {

 console.log("error in axiosInstance::" ,  error)
    const originalRequest = error.config;

    if (error.response && error.response.status === 403 && !originalRequest._retry) {
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
          "/auth/refresh-token",
          {},
          {
            withCredentials: true, // Send HTTP-only refresh token cookie
          }
        );

        

        const newAccessToken = response.data.accessToken;
        localStorage.setItem("authToken", newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return axiosInstance(originalRequest);
      } catch (refreshError) {

        console.log("catch  refresh token end point");
        processQueue(refreshError, null);
        showSessionExpiredAlert();
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;