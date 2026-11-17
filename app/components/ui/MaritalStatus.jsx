function MaritalStatus({ ...props }) {
  return (
    <select className="form-select" {...props}>
      <option value="">Select</option>
      <option value="Single">Single</option>
      <option value="Married">Married</option>
      <option value="Divorced">Divorced</option>
      <option value="Widowed">Widowed</option>
    </select>
  );
}

export default MaritalStatus;
