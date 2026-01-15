# Cascading Dropdowns Implementation - Complete Guide

## Overview
Implemented intelligent cascading dropdowns in the Add Employee form to provide a hierarchical selection experience:
- **Country → Region → Company → Location**
- **Department → Designation**

This ensures data consistency and improves user experience by showing only relevant options based on previous selections.

---

## 🎯 How It Works Now

### Company Hierarchy Flow:
1. **Select Country** (e.g., India)
   - Automatically filters Regions (e.g., Maharashtra, Karnataka)
   - Automatically filters Companies operating in that country

2. **Select Region** (Optional)
   - Helps narrow down location choices

3. **Select Company** (e.g., Miebach India)
   - Shows only companies in the selected country
   - Automatically filters Locations to show only cities of that company in that country

4. **Select Location** (e.g., Mumbai, Pune)
   - Shows only locations that belong to the selected company AND country

### Department/Designation Flow:
1. **Select Department** (e.g., IT, HR, Finance)
   - All departments shown

2. **Select Designation** (e.g., Software Engineer, Manager)
   - Shows only designations that belong to the selected department
   - Dropdown is disabled until department is selected

---

## 📋 Backend Changes

### File: `ems-backend/routes/employee.js`

#### Enhanced `/api/employees/lookups` Endpoint:

**What was added:**
```javascript
// Now returns comprehensive data with relationships
{
  countries: [{ country_id, country_name }],
  regions: [{ region_id, region_name, country_id, country_name }],
  companies: [{ company_id, company_name, country_id, country_name }],
  locations: [{ 
    location_id, city, state, 
    company_id, country_id, region_id,
    company_name, country_name, region_name 
  }],
  departments: [{ department_id, department_name }],
  designations: [{ 
    designation_id, designation_name, 
    department_id, department_name,
    min_ctc_lpa, max_ctc_lpa 
  }],
  userContext: {
    country_id,  // HR's default country
    region_id    // HR's default region
  }
}
```

**Benefits:**
- Single API call loads all data with relationships
- HR's default country/region pre-selected
- Frontend can filter data client-side (fast, no additional API calls)

---

## 🎨 Frontend Changes

### File: `hrms-frontend/src/pages/AddEmployee.jsx`

#### New State Variables:

```javascript
// Master data (all records from API)
const [allCountries, setAllCountries] = useState([]);
const [allRegions, setAllRegions] = useState([]);
const [allCompanies, setAllCompanies] = useState([]);
const [allLocations, setAllLocations] = useState([]);
const [allDepartments, setAllDepartments] = useState([]);
const [allDesignations, setAllDesignations] = useState([]);

// Filtered data (shown in dropdowns based on selections)
const [filteredRegions, setFilteredRegions] = useState([]);
const [filteredCompanies, setFilteredCompanies] = useState([]);
const [filteredLocations, setFilteredLocations] = useState([]);
const [filteredDesignations, setFilteredDesignations] = useState([]);
```

#### New Filter Functions:

1. **`filterRegionsByCountry(countryId)`**
   - Filters regions to show only those in selected country

2. **`filterCompaniesByCountry(countryId)`**
   - Filters companies to show only those operating in selected country

3. **`filterLocationsByCompanyAndCountry(companyId, countryId)`**
   - Filters locations by BOTH company AND country
   - Ensures only relevant cities are shown

4. **`filterDesignationsByDepartment(departmentId)`**
   - Filters designations to show only those in selected department

#### Enhanced `handleChange` Function:

```javascript
// Cascading logic
if (name === 'country_id') {
  // Reset dependent fields
  setFormData(prev => ({
    ...prev,
    region_id: '',
    company_id: '',
    location_id: ''
  }));
  // Filter regions and companies
  filterRegionsByCountry(value);
  filterCompaniesByCountry(value);
}

if (name === 'company_id') {
  // Reset location
  setFormData(prev => ({ ...prev, location_id: '' }));
  // Filter locations
  filterLocationsByCompanyAndCountry(value, formData.country_id);
}

if (name === 'department_id') {
  // Reset designation
  setFormData(prev => ({ ...prev, designation_id: '' }));
  // Filter designations
  filterDesignationsByDepartment(value);
}
```

#### Updated Form UI:

```jsx
{/* NEW: Country dropdown */}
<select name="country_id" value={formData.country_id}>
  <option value="">Select Country</option>
  {allCountries.map(c => ...)}
</select>

{/* NEW: Region dropdown (disabled until country selected) */}
<select name="region_id" disabled={!formData.country_id}>
  <option value="">Select Region</option>
  {filteredRegions.map(r => ...)}
</select>

{/* UPDATED: Company dropdown (now filtered by country) */}
<select name="company_id" disabled={!formData.country_id}>
  <option value="">Select Company</option>
  {filteredCompanies.map(c => ...)}
</select>

{/* UPDATED: Location dropdown (filtered by company & country) */}
<select name="location_id" disabled={!formData.company_id}>
  <option value="">Select Location</option>
  {filteredLocations.map(l => ...)}
</select>

{/* Department dropdown (no change) */}
<select name="department_id">
  <option value="">Select Department</option>
  {allDepartments.map(d => ...)}
</select>

{/* Designation dropdown (filtered by department) */}
<select name="designation_id" disabled={!formData.department_id}>
  <option value="">Select Designation</option>
  {filteredDesignations.map(d => ...)}
</select>
```

#### Help Text:
Each dependent dropdown shows helpful text when parent is not selected:
- "Select country first" - for Region, Company
- "Select company first" - for Location
- "Select department first" - for Designation

---

## 🔄 User Flow Example

### Scenario: Adding employee at Miebach India - Mumbai office

1. **User opens Add Employee form**
   - Country: Auto-selected to "India" (HR's default)
   - Region: Shows "Maharashtra", "Karnataka", etc.
   - Company: Shows "Miebach India" (filtered by country)
   - Location: Disabled (waiting for company selection)

2. **User selects Company: "Miebach India"**
   - Location: Now enabled, shows "Mumbai", "Pune", "Bangalore" (only Miebach locations in India)

3. **User selects Location: "Mumbai"**
   - Continues to other fields...

4. **User selects Department: "IT"**
   - Designation: Now enabled, shows "Software Engineer", "Tech Lead", "Architect" (only IT designations)

5. **User selects Designation: "Software Engineer"**
   - Form complete, ready to submit!

---

## ✅ Benefits

### 1. **Data Consistency**
- Impossible to select Mumbai office for a US company
- Designations always match the selected department

### 2. **Better UX**
- Fewer irrelevant options to scroll through
- Clear hierarchy and relationships
- Helpful guidance text

### 3. **Performance**
- Single API call loads all data
- Client-side filtering is instant
- No additional server requests

### 4. **Smart Defaults**
- HR's country/region pre-selected based on login
- Reduces clicks for most common scenarios

### 5. **Error Prevention**
- Dropdowns disabled until prerequisites are met
- Dependent selections reset when parent changes
- Form validation ensures country is selected

---

## 🧪 Testing Checklist

- [ ] Open Add Employee form - verify country is pre-selected
- [ ] Select different country - verify regions and companies update
- [ ] Select company - verify locations are filtered correctly
- [ ] Change country - verify company and location reset
- [ ] Select department - verify designations are filtered
- [ ] Change department - verify designation resets
- [ ] Try submitting without country - verify validation error
- [ ] Complete full flow and submit - verify employee is created

---

## 📊 Database Schema Relationships

```
country (1) -----> (*) region
   |
   |-----> (*) company
   |           |
   |           |-----> (*) location
   |                      |
   |                      |-----> (*) employee
   |----------------------^

department (1) -----> (*) designation
                           |
                           |-----> (*) employee
```

---

## 🔧 Validation Rules

### Required Fields:
- ✅ Country (NEW - now required)
- ✅ Company
- ✅ Location
- ✅ Department
- ✅ Designation

### Optional Fields:
- Region (helps narrow down locations)

### Field Dependencies:
- Region requires: Country
- Company requires: Country
- Location requires: Company + Country
- Designation requires: Department

---

## 📝 Files Modified

### Backend:
- `ems-backend/routes/employee.js`
  - Enhanced GET `/api/employees/lookups` endpoint
  - Added country, region data
  - Added relationship fields to all lookups
  - Added userContext for defaults

### Frontend:
- `hrms-frontend/src/pages/AddEmployee.jsx`
  - Added country_id, region_id to form state
  - Added master data state variables
  - Added filtered data state variables
  - Implemented 4 filter functions
  - Enhanced handleChange with cascading logic
  - Updated form UI with new dropdowns
  - Added help text for dependent fields
  - Updated validation to require country

---

## 💡 Future Enhancements

Possible improvements:
1. Add "All Regions" option to show all locations in country
2. Show designation salary range hints when selected
3. Add location timezone information
4. Save user's last selections for next time
5. Add search/filter within dropdowns for large lists

---

## 🎉 Summary

The cascading dropdowns provide a much better user experience:
- **Logical flow**: Country → Company → Location
- **Department → Designation**
- **Smart filtering**: Only see relevant options
- **Pre-filled defaults**: Based on HR's profile
- **Error prevention**: Can't make invalid selections
- **Fast**: No extra API calls needed

This matches real-world employee onboarding where you first determine the country/company, then the specific location within that company!
