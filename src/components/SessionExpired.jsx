import Swal from "sweetalert2";

export const showSessionExpiredAlert = () => {
  Swal.fire({
    title: "Session Expired",
    text: "Please log in again.",
    icon: "warning",
    confirmButtonText: "OK",
  }).then(() => {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  });
};
