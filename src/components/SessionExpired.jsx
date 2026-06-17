import Swal from "sweetalert2";

const AUTH_KEYS = [
  "authToken",
  "userRole",
  "UserName",
  "currentActiveRole",
  "makeYourOwnPackageAgentId",
];

export const clearAuthStorage = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const showSessionExpiredAlert = () => {
  Swal.fire({
    title: "Session Expired",
    text: "Please log in again.",
    icon: "warning",
    confirmButtonText: "OK",
  }).then(() => {
    clearAuthStorage();
    window.location.href = "/login";
  });
};
