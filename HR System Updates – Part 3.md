# HR System Updates – Part 3

This document details the functional specifications and updates required for the HR System, transcribed and specified directly from the management requirements note.

---

## 1. Original Requirements from Notes

The 8 numbered requirements from the document are:

```text
1) In Employee page -> Remove Branch/Location Box
2) In Employee page -> When user typing data in any date secssion, it should be auto mask
3) In employee page -> when user tring to add add employe, it will open form, in that form Having operational selection box , inside that box some company name shortly written. So show full name of the those company names ...
4) Always remember whenever typing date it should be having auto mask ok..
5) Also in employee page, include employee delete function for each employee
6) Also user can print employees ... ad .pdf file save format for employee.. (user can seltect any type and print any type of having employee ok)
7) In employe page, there is a selection box which is all employe code .. so remove that box
8) In MOL register, Once click MOL code company, it should be open to the employees and it can be also save .pdf file
```

---

## 2. Requirement Breakdown & Detailed Specifications

### ① Remove Branch/Location Box (`In Employee page -> Remove Branch/Location Box`)
* **Context:** Branch / Location dropdown and subtitle are obsolete in employee management workflows.
* **Requirements:**
  * Remove the **Branch / location** input dropdown from the Add/Edit Employee Form (`EmployeeForm.jsx`).
  * Ensure the backend payload maintains safe fallback to default location so existing records and foreign keys are preserved.
  * Remove the location text displayed under department in the Employees list table (`Employees.jsx`).
  * Clean up location subtitles in the Employee Profile header (`EmployeeProfile.jsx`).

---

### ② & ④ Universal Date Typing Auto-Mask (`When user typing data in any date secssion, it should be auto mask / Always remember whenever typing date it should be having auto mask ok..`)
* **Context:** Users entering dates (Date of Birth, Joining Date, Document Issue & Expiry Dates, Leave Start/End, Rejoining Dates) currently type manually or pick from calendar.
* **Requirements:**
  * Global auto-masking in the central `<DateInput>` component (`web/src/core/ui.jsx`).
  * As the user enters digits (e.g. `15082024`):
    * Typing 2 digits auto-appends `/` (e.g. `15/`).
    * Typing month digits auto-appends `/` (e.g. `15/08/`).
    * Typing year accepts up to 4 digits (e.g. `15/08/2024`).
  * Clean backspace handling: does not trap cursor or re-insert slashes when deleting backward.
  * Supports manual single-digit day/month entry (e.g. typing `5/` auto-pads to `05/`).
  * Automatically applies to all date sessions across Employee Form, Leave Modals, Rejoining Reports, Document Modals, and Fleet.

---

### ③ Operational Company Full Name Display (`In employee page -> when user tring to add add employe... show full name of the those company names`)
* **Context:** In the Add/Edit Employee Form, the "Operational company" dropdown was previously displaying abbreviated company names (`c.short || c.name`).
* **Requirements:**
  * In the Operational Company dropdown in `EmployeeForm.jsx`, render the full official company name (`c.name`).
  * Ensures exact parity with the Visa Sponsoring Company selector.

---

### ⑤ Employee Delete Function (`Also in employee page, include employee delete function for each employee`)
* **Context:** HR and administrators need to delete obsolete or erroneously created employee records.
* **Requirements:**
  * **Backend API (`server/src/routes/hr.ts`):**
    * `DELETE /api/employees/:no` protected by `can(req.user, 'editEmployee')`.
    * Runs inside a single atomic database transaction (`tx`):
      1. Deletes associated `leave_events` and `leave_requests`.
      2. Deletes associated `documents`, `document_versions`, and `expiry_actions`.
      3. Nullifies photo foreign key and deletes `files` records.
      4. Deletes employee record from `employees`.
      5. Records audit log: `Delete Employee {name} ({emp_no})`.
    * Cleans up physical disk storage after transaction commit.
  * **Frontend (`web/src/core/store.jsx`):**
    * `deleteEmployee(no)` action updates reactive state.
  * **UI (`Employees.jsx` & `EmployeeProfile.jsx`):**
    * Delete button on each employee table row in `Employees.jsx`.
    * Delete button in `EmployeeProfile.jsx` header actions.
    * Modal confirmation dialog displaying employee name and number before executing deletion.

---

### ⑥ Print Employees with PDF Save Format & Flexible Type Selection (`Also user can print employees ... ad .pdf file save format for employee.. (user can seltect any type and print any type of having employee ok)`)
* **Context:** Management and HR need to generate and print formal employee master rosters as PDF.
* **Requirements:**
  * Add a **"Print / Export PDF"** button in `Employees.jsx`.
  * Opens `EmployeePrintModal.jsx`:
    * Filters: Department, Visa Sponsor, Operational Company, Employment Status (Active, On Notice, Terminated, Resigned, All), Nationality, Search.
    * Checkbox selection: "Select All" toggle + individual employee selection checkboxes so users can select any combination of employees.
    * Formal corporate letterhead: "ADROIT BUILDING MATERIAL TRADING ENTERPRISES", Human Resources Department · Master Employee Register.
    * Columns: `#`, `EMP Name`, `EMP Number`, `EMP Code`, `Department`, `Visa Sponsor`, `Operational Company`, `Designation`, `Status`, `Joining Date`, `Contact No`.
    * Compliance signature lines: Prepared By, Verified By, Approved By.
    * Instant browser print / save to PDF via `window.print()`.

---

### ⑦ Remove "All Employee Code" Selection Box (`In employe page, there is a selection box which is all employe code .. so remove that box`)
* **Context:** The employee code dropdown in the Employees list filters was redundant.
* **Requirements:**
  * Remove `<select id="f-code">` from `Employees.jsx`.
  * Remove associated state and memo logic.
  * Searching by employee code remains available in the free-text search box.

---

### ⑧ MOL Register: Click Company to Open Employees & Save PDF (`In MOL register, Once click MOL code company, it should be open to the employees and it can be also save .pdf file`)
* **Context:** In `MolRegister.jsx`, the Company MOL codes table lists companies and their MOL code.
* **Requirements:**
  * Clicking a company row or sponsored employee count opens `MolCompanyModal.jsx`.
  * Displays:
    * Sponsoring Company Name & MOL Code.
    * Total sponsored headcount.
    * Table of employees: `EMP Number`, `EMP Code`, `Name`, `Designation`, `Department`, `Emp (MOL) ID`, `Labour Card Number & Expiry`, `Joining Date`.
    * Formal printable view with corporate letterhead.
    * "Print / Export PDF" button (`window.print()`).

---

## 3. Impacted Files

| Component | File Path | Scope |
|---|---|---|
| **Server Routes** | [`server/src/routes/hr.ts`](file:///e:/Adroit%20Integrated%20Management%20Platform/server/src/routes/hr.ts) | Add `DELETE /api/employees/:no` with transaction & audit. |
| **Store State** | [`web/src/core/store.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/core/store.jsx) | Add `deleteEmployee` action. |
| **UI Components** | [`web/src/core/ui.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/core/ui.jsx) | Auto-masking for `DateInput`, add `trash`, `print`, `download` icons. |
| **Employee Form** | [`web/src/hr/EmployeeForm.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeForm.jsx) | Remove Branch/Location, show full company name. |
| **Employee Master** | [`web/src/hr/Employees.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Employees.jsx) | Remove code dropdown & location text, add delete action & print modal trigger. |
| **Employee Profile** | [`web/src/hr/EmployeeProfile.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeProfile.jsx) | Clean up subtitle, add Delete button with confirmation. |
| **Employee Print Modal** | [`web/src/hr/EmployeePrintModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeePrintModal.jsx) | Full multi-criteria filtering, employee checklist, formal PDF layout. |
| **MOL Company Modal** | [`web/src/hr/MolCompanyModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/MolCompanyModal.jsx) | Sponsored employee roster for company MOL code with PDF export. |
| **MOL Register** | [`web/src/hr/MolRegister.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/MolRegister.jsx) | Interactive company row clicks to trigger modal. |
