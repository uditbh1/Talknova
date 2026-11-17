function TitleSelect({ ...props }) {
  return (
    <select className="form-select" {...props}>
      <option value="">Select Title</option>
      <option value="Mr">Mr</option>
      <option value="Ms">Ms</option>
      <option value="Mrs">Mrs</option>
      <option value="Miss">Miss</option>
      <option value="Dr">Dr</option>
      <option value="Prof">Prof</option>
    </select>
  );
}

export default TitleSelect;
