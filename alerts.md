Okay, understood. Let's refine the list, removing the user self-service alerts and adding the administrator registration approval alert:

**Core Workflow Alerts (from `dataflow.md`):**

1.  **New Requirement Submitted:**

    - **Trigger:** After an institution successfully creates a new requirement.
    - **API:** `POST /requirements`
    - **Recipient:** Warehouse users responsible for the selected warehouse.
    - **Purpose:** Notify the warehouse of a new pending requirement needing approval.

2.  **Requirement Status Updated (Approved/Rejected/Partially Approved):**

    - **Trigger:** After a warehouse user approves, rejects, or modifies the requested items.
    - **API:** `PATCH /requirements/:id/approve` (or a similar endpoint handling status updates).
    - **Recipient:** The institution user(s) who created the requirement.
    - **Purpose:** Inform the institution about the outcome of their request.

3.  **Shipment Dispatched:**

    - **Trigger:** After a warehouse user creates and dispatches a shipment for an approved requirement.
    - **API:** `POST /logistics`
    - **Recipient:** The institution user(s) associated with the requirement.
    - **Purpose:** Notify the institution that their order is on its way, potentially including transport details if available.

4.  **Shipment Marked as Delivered:**

    - **Trigger:** After a warehouse user marks a shipment as delivered.
    - **API:** `PATCH /logistics/:id/status` (specifically when the status changes to "Delivered").
    - **Recipient:** The institution user(s) expecting the shipment.
    - **Purpose:** Inform the institution that the delivery partner has marked the shipment as arrived, prompting them to confirm receipt.

5.  **Shipment Received by Institution:**
    - **Trigger:** After an institution user confirms they have received the shipment.
    - **API:** `PATCH /logistics/:id/receive`
    - **Recipient:** Warehouse users responsible for the sending warehouse.
    - **Purpose:** Confirm to the warehouse that the shipment cycle is complete and the goods were received.

**Administrative Alerts:**

6.  **User Registration Approved/Rejected:**
    - **Trigger:** After an administrator approves or rejects a pending user registration.
    - **API:** This would likely be an admin-specific endpoint, e.g., `PATCH /admin/users/:userId/status`, `POST /admin/users/:userId/approve`, or similar.
    - **Recipient:** The user whose registration status was changed.
    - **Purpose:** Inform the user whether their account registration has been approved or rejected.

This revised list focuses on the core operational flow and the requested administrative action.
