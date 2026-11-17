import { useLoaderData } from '@remix-run/react';

function YesNoDropdown({ ...props }) {
  return (
    <select className="form-select" {...props}>
      <option value="">Select</option>
      <option value="NO">No</option>
      <option value="YES">Yes</option>
    </select>
  );
}

export default YesNoDropdown;
