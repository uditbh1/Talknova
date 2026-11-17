import { useState, useEffect } from "react";

export default function CourseCategorySelect({ name, className, defaultValue }) {
  const [selectedCategory, setSelectedCategory] = useState(defaultValue);
  const [subCategories, setSubCategories] = useState([]);

  useEffect(() => {
    if (selectedCategory) {
      setSubCategories(categories[selectedCategory]);
    }
  }, [selectedCategory]);

  return (
    <>
      <select name={name} className={className} defaultValue={defaultValue} required onChange={(e) => setSelectedCategory(e.target.value)}>
        <option value="">Select</option>
        {Object.keys(categories).map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <CourseSubCategorySelect className={className} name="subCategory" subCategories={subCategories} defaultValue={defaultValue} />
    </>
  );
}

export function CourseSubCategorySelect({ name, className, subCategories, defaultValue }) {
  return (
    <select name={name} className={className} required>
      <option value="">Select</option>
      {subCategories.map((subCategory) => (
        <option key={subCategory} value={subCategory}>
          {subCategory}
        </option>
      ))}
    </select>
  );
}
