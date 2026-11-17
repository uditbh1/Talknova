function GenderSelect({ ...props }) {
  return (
    <select className="form-select" {...props}>
      <option value="">Select Title</option>
      <option value="MALE">Male</option>
      <option value="FEMALE">Female</option>
    </select>
  );
}

export default GenderSelect;
