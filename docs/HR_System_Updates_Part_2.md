# HR System Updates – Part 2

This document details the functional specifications and updates required for the HR System and the Leave & Rejoining workflow, transcribed and specified directly from the management handwritten requirements note.

---

## 1. Original Requirements from Handwritten Notes

The 7 numbered requirements from the handwritten document are:

```text
① laber card -> document
② laber card -> Expiry Date
③ when apply leave -> print form include Sponser company name.
④ user can get report -> on vacation Search (Leave & Rejoining page)
                         Apply leave Rejected
⑤ (Leave & Rejoining page) -> Rejoining Add 
   (Leave & vacation - How many have order by name)
   once select employee Auto fill details
⑥ (Leave & Rejoining) -> we need to get Report.... From... to.....
   Employee Rejoind name details list. also user can get .pdf report.
⑦ (Leave & Rejoining) -> in new leave Request ->
   once select employee, Auto fill home number
```

---

## 2. Requirement Breakdown & Detailed Specifications

### ① Labour Card → Document (`laber card -> document`)
* **Context:** In employee management, Labour Card (Ministry of Labour / MOHRE card) must have complete document handling.
* **Requirements:**
  * Support digital copy / document attachment (PDF, PNG, JPG) for Labour Card records.
  * Allow users to upload, preview, replace, and download the scanned Labour Card document.
  * Display the Labour Card document status and scan link in the **Employee Profile** (under both the **Labour Card** tab and **Documents** tab) and in document lists.
  * Maintain version history when a renewed Labour Card document is uploaded.

---

### ② Labour Card → Expiry Date (`laber card -> Expiry Date`)
* **Context:** Tracking the validity of Labour Cards to avoid MOHRE regulatory fines and compliance lapses.
* **Requirements:**
  * Add / display explicit **Expiry Date** tracking for Labour Card in the system.
  * Include Labour Card in the document expiry monitoring system:
    * **Urgent threshold:** 30 days before expiry.
    * **Due threshold:** 60 days before expiry.
    * **Monitor threshold:** 90 days before expiry.
  * Surface expiring Labour Cards in the **Attention Centre** and the **Documents & Expiry** module with alert badges.
  * Allow PRO / HR compliance officers to initiate renewal actions directly from the expiring Labour Card record.

---

### ③ Leave Application Print Form: Include Sponsor Company Name (`when apply leave -> print form include Sponser company name.`)
* **Context:** When an employee applies for leave, the printable leave form (`LeavePrintModal`) is submitted for management approval and formal documentation.
* **Requirements:**
  * The printed leave application form must clearly state the **Sponsor Company Name** (Visa sponsoring entity).
  * Display both:
    1. **Operational Company Name** (where the employee performs daily work).
    2. **Sponsor Company Name** (the legal entity under which the employee's visa / labour card is registered).
  * The Sponsor Company name must be placed prominently in the header section, company reference block, and the HR / Management approval block.

---

### ④ Leave & Rejoining Page: "On Vacation" Search & "Apply Leave Rejected" Report (`user can get report -> on vacation Search (Leave & Rejoining page) / Apply leave Rejected`)
* **Context:** In the **Leave & Rejoining** page (`#hr-leave`), users need quick search capabilities and reports for employees on vacation and rejected leave requests.
* **Requirements:**
  * **On Vacation Search:**
    * Add a search bar to instantly search and filter employees who are currently away on vacation / leave.
    * Allow searching by employee name, employee number, code, or department.
    * View report/list of currently on-leave staff with departure date, expected return date, and contact number.
  * **Apply Leave Rejected Report:**
    * Provide a dedicated view / filter for **Rejected Leave Applications**.
    * Display rejected leave records with:
      * Leave reference number
      * Employee name, ID, and department
      * Leave type and requested dates
      * Rejection date and decided by
      * Reason for rejection

---

### ⑤ Leave & Rejoining Page: "Rejoining Add" with Auto-Fill (`(Leave & Rejoining page) -> Rejoining Add (Leave & vacation - How many have order by name) once select employee Auto fill details`)
* **Context:** Recording when an employee returns to duty after vacation currently requires searching through table rows.
* **Requirements:**
  * Add a dedicated **"Add Rejoining" / "Record Rejoining"** button on the Leave & Rejoining page.
  * Clicking this button opens a modal/form to record employee return to duty:
    * **Employee Selection List:** Lists all employees currently away on leave / vacation.
    * **Counter:** Displays how many employees are currently on vacation (e.g. `Select Employee (8 currently on leave)`).
    * **Sorting:** The employee dropdown/list must be ordered alphabetically by employee name (**A to Z**).
  * **Auto-Fill Details:**
    * Once the user selects an employee, the form **automatically auto-fills all their leave details**:
      * Employee number, code, and department
      * Leave type (Annual Leave, Sick Leave, Emergency Leave, etc.)
      * Leave period (Start date and End date)
      * Total leave duration (number of days)
      * Expected rejoining date
      * Overseas / leave contact number
    * The user only needs to enter the **Actual Rejoining Date** and any rejoining notes/remarks before saving.

---

### ⑥ Leave & Rejoining: Rejoined Employees Date-Range Report with PDF Export (`(Leave & Rejoining) -> we need to get Report.... From... to..... Employee Rejoind name details list. also user can get .pdf report.`)
* **Context:** Management and HR need historical reports of employees who rejoined work within any specified period.
* **Requirements:**
  * Under Leave & Rejoining (and HR Reports), provide a **Rejoined Employees Report**.
  * **Date Range Filters:**
    * **From Date:** Start date of period.
    * **To Date:** End date of period.
  * **Report Results:**
    * Lists all employees who rejoined duty between the selected "From" and "To" dates.
    * Columns:
      * Employee Name
      * Employee Number / Code
      * Department & Designation
      * Leave Type
      * Leave Period (From → To)
      * Total Days Taken
      * Actual Rejoined Date
      * Rejoining Remarks / Status (On time, Early, Late)
  * **PDF Export:**
    * Provide a button to download / print the report as a clean **.pdf** document with company branding, date parameters, and authorized signature lines.

---

### ⑦ New Leave Request: Auto-Fill Home Number (`(Leave & Rejoining) -> in new leave Request -> once select employee, Auto fill home number`)
* **Context:** When creating a new leave request (`ApplyLeaveModal`), users currently enter the contact number manually.
* **Requirements:**
  * In the **New Leave Request** modal, when the user selects an employee from the dropdown:
  * The system must **automatically auto-fill their Home Number / Contact Number** (from the employee profile: `emergencyContact` or `mobile` / home contact).
  * The populated phone number remains editable by the user if an alternative overseas number is provided for the specific trip.

---

## 3. Impacted System Modules & Components

| Component | File Path | Scope of Change |
|---|---|---|
| **Employee Form** | [`web/src/hr/EmployeeForm.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeForm.jsx) | Ensure Labour Card document scan attachment & expiry date inputs are standard. |
| **Employee Profile** | [`web/src/hr/EmployeeProfile.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeProfile.jsx) | Show Labour Card document upload, expiry alerts, and print form trigger. |
| **Leave Management** | [`web/src/hr/Leave.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Leave.jsx) | Add "On Vacation" search bar, "Rejected" report/filter, and "Add Rejoining" button. |
| **Apply Leave Modal** | [`web/src/hr/ApplyLeaveModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/ApplyLeaveModal.jsx) | Auto-fill home/contact number upon employee selection. |
| **Leave Print Modal** | [`web/src/hr/LeavePrintModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/LeavePrintModal.jsx) | Include Sponsor Company Name in the printable leave document. |
| **Rejoining Action Modal** | [`web/src/hr/Leave.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Leave.jsx) / `RejoinModal.jsx` | Implement Rejoining selection with alphabetical ordering and details auto-fill. |
| **Rejoining Reports** | [`web/src/hr/Reports.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Reports.jsx) | Add Date-Range (From... to...) Rejoined Report with `.pdf` export capability. |
| **HR Server Endpoints** | [`server/src/routes/hr.ts`](file:///e:/Adroit%20Integrated%20Management%20Platform/server/src/routes/hr.ts) | Provide date-range queries for rejoined employees and rejected leave queries. |

---

## 4. Acceptance Criteria & Sign-Off Checklist

- [x] **1. Labour Card Document:** Labour Card file/scan upload, preview, and download are available and functional in [`EmployeeProfile.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeProfile.jsx) and [`EmployeeForm.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/EmployeeForm.jsx).
- [x] **2. Labour Card Expiry Date:** Expiry date is displayed and monitored with automated alerts (90/60/30 days) and integrated in [`Reports.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Reports.jsx) renewal chart.
- [x] **3. Print Form Sponsor Company:** Leave application print view ([`LeavePrintModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/LeavePrintModal.jsx)) prominently includes Operational Company in header and Visa Sponsoring Company in the application body and under the HR Manager / Managing Director signature block (without extra "Operating:" or "Visa Sponsor:" prefixes).
- [x] **4. On-Vacation Search & Rejected Leaves:** In [`Leave.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/Leave.jsx), users can search on-vacation staff in real-time (`#vacation-search`) and review all rejected leaves with reasons and timestamps under the dedicated "Rejected requests" tab.
- [x] **5. Add Rejoining with Auto-Fill:** Dedicated rejoining modal ([`RejoinAddModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/RejoinAddModal.jsx)) lists vacation employees ordered by name with count badge, and automatically auto-fills all leave details upon selection.
- [x] **6. Rejoined Date-Range Report (PDF):** Interactive modal ([`RejoinedReportModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/RejoinedReportModal.jsx)) queries rejoined employees between "From" and "To" dates and exports/prints high-resolution `.pdf` reports with letterhead and signature lines.
- [x] **7. Leave Request Home Number Auto-Fill:** Selecting an employee in [`ApplyLeaveModal.jsx`](file:///e:/Adroit%20Integrated%20Management%20Platform/web/src/hr/ApplyLeaveModal.jsx) automatically auto-populates their home/contact number into the contact input.

