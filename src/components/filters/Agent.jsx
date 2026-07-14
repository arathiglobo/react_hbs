import { useEffect,useState } from "react";
import { Form } from "react-bootstrap";
import axiosInstance from "../AxiosInstance";
import chevronStyle from "./dropdownChevron";

export default function Agent({value, onChange}){

    const [agents,setAgents]=useState([]);
    const [isOpen,setIsOpen]=useState(false);
    const [searchTerm,setSearchTerm] = useState("");

    useEffect(()=>{
        axiosInstance.get("/api/agent")
        .then(res=>setAgents(res.data || []))
        .catch(err=> console.error(err));
    },[]);

    const filtered = searchTerm ? agents.filter(ac => ac.companyName?.toLowerCase().includes(searchTerm.toLowerCase())) : agents;
    const selectedOption = agents.find(opt=>String(opt.id || opt.agentId)===String(value))


    return(
        <Form.Group>
            <Form.Label>Agent</Form.Label>
            <div className="position-relative">
                <Form.Control size="sm"
                style={chevronStyle}
                value={isOpen ? searchTerm : (selectedOption?.companyName ||"")}
                onChange={(e)=>{setSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);}}
                    onFocus={()=>setIsOpen(true)}
                    placeholder="select agent"
                    autoComplete="off"/>
                    {isOpen&&(
                        <>
                        <div className="position-absolute w-100 bg-white border shadow-lg"
                        style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto", top: "100%" }}>
                        {filtered.map(opt=>(
                            <div key={opt.id || opt.agentId} className="px-3 py-2" 
                            style={{cursor:"pointer"}}
                            onMouseEnter={e=>e.target.style.backgroundColor = "#f8f9fa"}
                            onMouseLeave={e=> e.target.style.backgroundColor = "white"}
                            onClick={()=>{onChange(opt.id || opt.agentId); setIsOpen(false);setSearchTerm("");}}>
                             {opt.companyName}
                            </div>
                        ))}
                        </div>
                       <div className="position-fixed" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                 onClick={() => { setIsOpen(false); setSearchTerm(""); }} />
                        </>
                    )}
            </div>
        </Form.Group>
    )
}



