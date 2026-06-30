# QuoteForge Product Requirements Document (PRD)

## RFQ & AI-Assisted Quoting Workflow (MVP)

Version: 2.0
Status: MVP Specification
Audience: Claude Code / Cursor / Copilot / AI Coding Agents

---

# 1. Product Vision

QuoteForge is an AI-assisted estimating platform for custom manufacturers.

QuoteForge **does not replace the estimator**.

Its goal is to eliminate repetitive administrative work by automatically extracting information from manufacturing documents and preparing a draft estimate.

QuoteForge is **NOT**:

* CAD software
* CAM software
* ERP
* MRP
* Toolpath generator

QuoteForge **IS**:

* RFQ Manager
* AI Document Assistant
* Manufacturing Estimator
* Professional Quote Generator

---

# 2. Design Principles

1. Customer must exist before an RFQ can be created.
2. Every RFQ belongs to one customer.
3. AI extracts information only from uploaded documents.
4. Estimator reviews every AI-generated value.
5. AI never generates a final quote automatically.
6. Quote IDs are created only after estimator approval.

---

# 3. User Workflow

```text
Dashboard
    │
    ▼
New RFQ
    │
    ▼
Customer Lookup
    │
 ┌──┴─────────────┐
 │                │
Existing      New Customer
 │                │
 │         Create Customer
 │                │
 └──────┬─────────┘
        ▼
Create RFQ
(RFQ-YYYY-000001)
        │
        ▼
Upload RFQ Package
(PDF / XLSX / CSV / ZIP)
        │
        ▼
AI Metadata Extraction
        │
        ▼
Estimator Review
(Tab 1)
        │
        ▼
Draft BOM
        │
        ▼
Material
(Tab 2)
        │
        ▼
Labor
(Tab 3)
        │
        ▼
Review & Pricing
        │
        ▼
Generate Quote
(Q-YYYY-000001)
        │
        ▼
Generate PDF
        │
        ▼
Send Quote
        │
        ▼
Won / Lost
```

---

# 4. Navigation

```
Dashboard

RFQs

Quotes

Customers

Material Library

Rate Library

Settings
```

---

# 5. Database Model

## Customer

```
Customer

Company

Contacts

Industry

Address

Phone

Email
```

Relationship

```
Customer

↓

RFQs

↓

Quotes

↓

Jobs (Future)
```

---

## RFQ

```
RFQ

id

customerId

status

assignedEstimator

createdDate

updatedDate
```

Status

```
New

AI Processing

Waiting Review

Ready For Quote

Quoted

Won

Lost
```

Each RFQ owns

```
Uploaded Files

Metadata

Draft BOM
```

---

## Quote

Quote is independent from RFQ but references it.

```
Quote

id

rfqId

customerId

status

revision

subtotal

margin

total
```

Status

```
Draft

Ready

Sent

Viewed

Accepted

Won

Lost
```

One RFQ may generate multiple quote revisions.

---

# 6. RFQ Creation

Step 1

Customer Lookup

Search existing customer.

If customer exists

Select customer.

Otherwise

Create customer.

Required fields

* Company
* Contact
* Email
* Phone
* Address
* Industry

---

Step 2

Create RFQ

Generate

```
RFQ-2026-000123
```

Assign

* Customer
* Estimator
* Created Date
* Status = New

---

# 7. Upload RFQ Package

Supported

```
PDF

XLSX

CSV

ZIP

DOCX

PNG

JPG
```

Future

```
STEP

DXF

DWG
```

Current MVP

Store CAD files only.

Do NOT parse geometry.

---

# 8. AI Processing

Automatically execute

```
Read PDF

↓

Read XLSX

↓

Read CSV

↓

OCR

↓

Extract Metadata

↓

Build Draft BOM
```

Display progress.

```
Uploading

Reading Documents

Extracting Metadata

Generating Draft BOM

Completed
```

---

# 9. Tab 1 — Metadata

Purpose

Populate estimate fields automatically.

Editable fields

* Part Number
* Drawing Number
* Revision
* Description
* Material
* Material Grade
* Thickness
* Quantity
* Finish
* Units
* Customer PO
* RFQ Number
* Due Date
* Weight (if available)
* Notes
* Special Instructions

Each field displays

* Extracted Value
* AI Confidence
* Editable Textbox

Missing fields

Display warning.

Example

```
⚠ Material Grade Missing

⚠ Finish Missing

⚠ Due Date Missing
```

Estimator approves metadata before continuing.

---

# 10. Draft BOM

Generate draft BOM.

Example

```
Item

Part Number

Material

Thickness

Quantity

Finish
```

User may

* Edit
* Delete
* Add Item

---

# 11. Tab 2 — Material

Populate using Material Library.

Fields

```
Material

Grade

Thickness

Supplier

Stock Size

Cost Per Unit

Waste %

Yield %

Markup %

Material Cost
```

Everything editable.

Live calculation.

---

# 12. Tab 3 — Labor

Operations

```
Laser

Plasma

Waterjet

Brake

Machining

Welding

Assembly

Painting

Powder Coat

Inspection

Packaging

Shipping
```

Each operation contains

```
Setup Hours

Run Hours

Hourly Rate

Outside Cost

Notes
```

Live summary updates automatically.

```
Material

Labor

Outside Services

Overhead

Subtotal

Margin

Quote Price
```

---

# 13. Review

Display summary

Customer

RFQ

Draft BOM

Material Cost

Labor Cost

Overhead

Margin

Final Price

Buttons

```
Back

Save Draft

Generate Quote

Generate PDF

Send Quote
```

---

# 14. Generated Quote

Generate Quote Number

```
Q-2026-000456
```

Status

Draft

Generate

* PDF
* Customer View

Future

Customer Portal

Electronic Acceptance

Revision Tracking

---

# 15. AI Responsibilities

AI SHOULD

* Read PDFs
* Read spreadsheets
* OCR drawings
* Extract title block data
* Extract quantities
* Extract notes
* Generate Draft BOM
* Suggest matching material from Material Library
* Highlight missing information

AI SHOULD NOT

* Estimate machining time
* Parse CAD geometry
* Generate toolpaths
* Replace estimator
* Auto-send quotations

---

# 16. Future Roadmap

Phase 2

* STEP metadata
* DXF storage
* Revision comparison
* Historical quote search

Phase 3

* AI similarity search
* Pricing recommendations
* Material supplier integrations

Phase 4

* RFQ Inbox
* Email integration
* Customer Portal
* Production Jobs

---

# 17. Acceptance Criteria

The MVP is complete when a user can:

✓ Create or select a customer

✓ Generate an RFQ

✓ Upload an RFQ package

✓ Automatically extract metadata

✓ Review and edit extracted data

✓ Generate a Draft BOM

✓ Select materials

✓ Estimate labor

✓ Calculate total cost

✓ Generate a professional PDF quotation

✓ Save and track RFQ and Quote history

---

# 18. Guiding Principle

QuoteForge's mission is not to automate engineering decisions.

Its mission is to remove repetitive administrative work so manufacturing estimators can produce accurate quotations faster, with full control over pricing and engineering judgment.
