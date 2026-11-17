const courseGroups = [
  "Career Bundles",
  "Animal care",
  "Law",
  "Teaching",
  "Accounting & Finance",
  "Training",
  "Design",
  "IT & Software",
  "Healthcare",
  "Marketing",
  "Health and Safety",
  "Construction",
  "Electronics",
  "Hospitality",
  "Health and Social Care",
  "Child Psychology",
  "Management",
  "Business Skills",
  "First Aid",
  "Employability",
  "Safeguarding",
  "Food Hygiene",
  "Personal Development",
  "Sustainability",
];

export default function CourseGroupSelect({ name, className, defaultValue }) {
  return (
    <select name={name} className={className} defaultValue={defaultValue} required>
      <option value="">Select</option>
      {courseGroups.map(group => (
        <option key={group} value={group}>{group}</option>
      ))}
    </select>
  );
}
