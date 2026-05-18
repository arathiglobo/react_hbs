import React from 'react'

const customStyles = {
  menuPortal: base => ({ ...base, zIndex: 9999 }),
};

const DropdownCustomSelect = () => {
  return (
    <Select
    {...props}
    menuPortalTarget={document.body}
    styles={{ ...customStyles, ...props.styles }}
    classNamePrefix="react-select"
  />
  )
}



export default DropdownCustomSelect