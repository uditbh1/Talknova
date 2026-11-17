import { useState, useEffect, useRef, useCallback } from "react";

const MultiSelect = ({
  api,
  data = [],
  preSelected = [],
  name,
  minLength = 2,
  maxItems = 8,
  valueField = "id",
  labelField = "value",
  placeholder = "Type to search...",
  noItemsMessage = "No items to select",
  keepOpenOnSelect = true,
  debounceDelay = 300, // New prop for debounce delay
  ...props
}) => {
  const [query, setQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState(preSelected);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounce function to limit API calls
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  const fetchSuggestions = (query) => {
    if (api) {
      // Fetch from API if provided
      fetch(`${api}?query=${query}&limit=${maxItems}`)
        .then((response) => response.json())
        .then((data) => filterSuggestions(data))
        .catch((error) => console.error("Error fetching data:", error));
    } else {
      // Local data filtering if API is not used
      const filteredData = data.filter((item) => item[labelField].toLowerCase().includes(query.toLowerCase()));
      filterSuggestions(filteredData);
    }
  };

  // Debounced version of the fetchSuggestions function
  const debouncedFetchSuggestions = useCallback(debounce(fetchSuggestions, debounceDelay), [api, data, debounceDelay]);

  const filterSuggestions = (suggestionsList) => {
    const filteredSuggestions = suggestionsList.filter((item) => !selectedItems.some((selectedItem) => selectedItem[valueField] === item[valueField]));
    setSuggestions(filteredSuggestions);
  };

  useEffect(() => {
    if (query.length >= minLength) {
      debouncedFetchSuggestions(query);
    } else if (query === "") {
      setSuggestions([]); // Clear suggestions if query is empty
    }
  }, [query, minLength, debouncedFetchSuggestions]);

  const handleSelect = (suggestion) => {
    const value = suggestion[valueField];
    if (!selectedItems.find((item) => item[valueField] === value)) {
      const newSelectedItems = [...selectedItems, suggestion];
      setSelectedItems(newSelectedItems);
      filterSuggestions(suggestions); // Update the suggestions immediately
    }
    setQuery("");
    if (keepOpenOnSelect) {
      setTimeout(() => inputRef.current.focus(), 0); // Keep focus on input to keep it open
    } else {
      setShowSuggestions(false);
    }
  };

  const handleRemoveItem = (itemToRemove) => {
    setSelectedItems(selectedItems.filter((item) => item[valueField] !== itemToRemove[valueField]));
    debouncedFetchSuggestions(query); // Update the suggestions after removal
  };

  const handleInputClick = () => {
    if (!query) {
      debouncedFetchSuggestions(""); // Fetch the first 5 items
      setShowSuggestions(true);
    }
  };

  const handleBlur = (event) => {
    // Check if the blur event is happening because of an interaction with the dropdown
    if (!dropdownRef.current.contains(event.relatedTarget) && !inputRef.current.contains(event.relatedTarget)) {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="position-relative" onBlur={handleBlur}>
      <select
        name={name}
        id={props.id}
        multiple
        hidden
        value={selectedItems.map((item) => item[valueField])}
        onChange={() => {}} // No-op to avoid React warning
      >
        {selectedItems.map((item) => (
          <option key={item[valueField]} value={item[valueField]}>
            {item[labelField]}
          </option>
        ))}
      </select>

      <input
        type="text"
        className="form-control"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClick={handleInputClick}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        ref={inputRef}
        {...props}
      />

      <div className="selected-items mt-2">
        {selectedItems.slice(0, 50).map((item) => (
          <span key={item[valueField]} className="badge bg-primary me-1">
            {item[labelField]} <button type="button" className="btn-close btn-close-white btn-sm" aria-label="Remove" onClick={() => handleRemoveItem(item)}></button>
          </span>
        ))}
        {selectedItems.length > 50 && <span className="badge bg-secondary">+{selectedItems.length - 50} more</span>}
      </div>

      {showSuggestions && (
        <ul ref={dropdownRef} className="list-group position-absolute w-100 mt-1" style={{ zIndex: 1000 }}>
          {suggestions.length === 0 && <li className="list-group-item list-group-item-action disabled">{noItemsMessage}</li>}
          {suggestions.slice(0, maxItems).map((suggestion) => (
            <li key={suggestion[valueField]} className="list-group-item list-group-item-action" onMouseDown={() => handleSelect(suggestion)}>
              {suggestion[labelField]}
            </li>
          ))}
          {suggestions.length > maxItems && <li className="list-group-item list-group-item-action disabled">+{suggestions.length - maxItems} more available</li>}
        </ul>
      )}
    </div>
  );
};

export default MultiSelect;
