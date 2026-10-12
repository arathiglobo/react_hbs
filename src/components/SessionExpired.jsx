import Swal from "sweetalert2";
import { clearAuthSession } from "../utils/authSession";

// Thin re-export so every existing call site (TopBar, Profile, Logout,
// the axios interceptor) keeps working unchanged. The actual key list and
// storage mechanism (this tab's sessionStorage — see utils/authSession.js)
// now live in one place instead of being hand-copied in four files.
export const clearAuthStorage = clearAuthSession;

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
