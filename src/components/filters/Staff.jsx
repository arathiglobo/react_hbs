import { useEffect, useState } from "react";
import axiosInstance from "../AxiosInstance";
import { Form } from "react-bootstrap";
import chevronStyle from "./dropdownChevron";

export default function Staff({ value, onChange }) {
  const [staff, setStaff] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

useEffect(()=>{
    axiosInstance.get("/api/employee")
    .then((res)=>setStaff(res.data || []))
    .catch((err)=>console.error("error fetching Staff:",err))
},[])

const filtered = searchTerm
 ? staff.filter(
    (s)=>
    `${s.firstName || ""} ${s.lastName || ""}`
    .toLowerCase()
.includes(searchTerm.toLowerCase()) ||
s.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
):staff;

const selectedOption = staff.find(
    (opt) => String(opt.employeeId) === String(value)
);

const getDisplayName =(employee)=>{
    const fullName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
    return fullName || employee.employeecode || "";
};


  return (
    <Form.Group>
      <Form.Label>Staff</Form.Label>
      <div className="position-relative">
        <Form.Control
          size="sm"
          style={chevronStyle}
          value={isOpen ? searchTerm : (selectedOption ? getDisplayName(selectedOption) : "")}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select staff"
          autoComplete="off"
        />
        {isOpen && (
          <>
            <div
              className="position-absolute w-100 bg-white border shadow-lg"
              style={{
                zIndex: 1050,
                maxHeight: "200px",
                overflowY: "auto",
                top: "100%",
              }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-muted">No staff found</div>
              ) : (
                filtered.map((opt) => (
                  <div
                    key={opt.employeeId}
                    className="px-3 py-2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.target.style.backgroundColor = "#f8f9fa")}
                    onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
                    onClick={() => {
                      onChange(opt.employeeId);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    {getDisplayName(opt)}
                    
                  </div>
                ))
              )}
            </div>
            <div
              className="position-fixed"
              style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
              onClick={() => {
                setIsOpen(false);
                setSearchTerm("");
              }}
            />
          </>
        )}
        </div>
    </Form.Group>
  );
}
