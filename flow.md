Okay, here's a task breakdown for integrating the requirement fulfillment APIs into a frontend application, broken down by user role and workflow phase:

**General Frontend Setup:**

1.  **Authentication:**
    - Implement login forms for Institution, Warehouse, and Admin users (using `POST /api/v1/auth/login` or similar).
    - Store the received JWT token securely (e.g., `localStorage`, `sessionStorage`, or secure cookie).
    - Create an API client/utility that automatically attaches the JWT (`Authorization: Bearer <token>`) to relevant outgoing requests.
    - Implement logout functionality (clearing the token).
    - Handle token expiration and potentially implement token refresh logic if your backend supports it.
    - Protect frontend routes based on user authentication status and potentially role.
2.  **State Management:** Choose and set up a state management solution (e.g., Redux, Zustand, Context API, Vuex, Pinia) to handle application state, API responses, loading indicators, and errors.
3.  **UI Components:** Create reusable UI components (tables, forms, buttons, modals, loading indicators, error messages, etc.).
4.  **API Client:** Set up a robust way to make API calls (e.g., using `axios`, `fetch` with wrappers) including base URL configuration and error handling.
5.  **Routing:** Set up frontend routing (e.g., React Router, Vue Router).

**I. Institution User Flow:**

1.  **View Available Warehouse Stock:**
    - **UI:** Create a page/component displaying available medicines across warehouses. Show Medicine Name, Manufacturer, Category, Total Available Quantity. Implement search/filtering (by name, category).
    - **API:** Fetch data using `GET /api/v1/warehouse-stock/available` (handles aggregation). Implement pagination/filtering based on query params.
2.  **Create Requirement:**
    - **UI:** Create a form/page:
      - Select Warehouse (fetch warehouses - _assuming a `GET /api/v1/warehouses` endpoint exists_).
      - Select Medicines (fetch medicines - _assuming a `GET /api/v1/medicines` endpoint exists_, allow adding multiple).
      - Input `requestedQuantity` for each selected medicine.
      - Submit button.
    - **State:** Manage form state, selected warehouse, list of medicines and quantities.
    - **API:** On submit, format the request body (`warehouseId`, `medicines` array) and call `POST /api/v1/requirements`.
    - **Feedback:** Display success/error messages. Clear form or redirect.
3.  **View Own Requirements:**
    - **UI:** Create a page/table listing requirements created by the logged-in institution. Columns: ID (link), Warehouse, Overall Status, Created Date, etc. Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/requirements` (pass pagination/sort query params).
4.  **View Requirement Details:**
    - **UI:** Create a detail view page showing requirement info, warehouse/institution details, list of medicines (Requested Qty, Approved Qty, Status), overall status, linked logistic ID (if any).
    - **API:** Fetch data using `GET /api/v1/requirements/:requirementId`.
5.  **View Incoming Shipments:**
    - **UI:** Create a page/table listing shipments destined for the logged-in institution. Columns: Shipment ID (link), Warehouse, Status, Received Status, Date, etc. Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/logistics/institution`.
6.  **View Shipment Details:**
    - **UI:** Detail view showing shipment info, warehouse/institution details, list of shipped medicines/batches, vehicle info, status, received status.
    - **API:** Fetch data using `GET /api/v1/logistics/:logisticId`.
7.  **Receive Shipment:**
    - **UI:** On the shipment detail view, add a "Mark as Received" button (enabled only if `receivedStatus` is 'Pending'). Optionally allow input for `arrivedAt`, `unloadedAt` timestamps.
    - **State:** Handle loading state for the receive action.
    - **API:** On click, call `PATCH /api/v1/logistics/:logisticId/receive` (include timestamps if captured).
    - **Feedback:** Update UI to show "Received". Disable button. Show success/error message.
8.  **Manage Own Institution Stock:**
    - **UI:**
      - Page to view own stock (table showing Medicine, Batches with details). Implement search/pagination.
      - Form/Modal to manually add stock (select Medicine, input batch details).
      - Ability to view stock item details (maybe expand row or separate view).
      - Ability to update batch details (non-quantity fields).
      - Ability to delete a stock item record.
    - **API:**
      - `GET /api/v1/institution-stock` (for listing).
      - `POST /api/v1/institution-stock` (for adding).
      - `GET /api/v1/institution-stock/:stockId` (for details - though listing might suffice).
      - `PUT /api/v1/institution-stock/:stockId` (for updating - requires `batchName` in body).
      - `DELETE /api/v1/institution-stock/:stockId` (for deleting).

**II. Warehouse User Flow:**

1.  **Manage Own Warehouse Stock:**
    - **UI:** Similar to Institution stock management, but for the warehouse's own inventory. View, Add, Update Batch Details, Delete.
    - **API:**
      - `GET /api/v1/warehouse-stock` (listing).
      - `POST /api/v1/warehouse-stock` (adding).
      - `GET /api/v1/warehouse-stock/:stockId` (details).
      - `PUT /api/v1/warehouse-stock/:stockId` (updating batch - needs `batchName`).
      - `DELETE /api/v1/warehouse-stock/:stockId` (deleting).
2.  **View Incoming Requirements:**
    - **UI:** Create a page/table listing requirements directed to the logged-in warehouse. Columns: ID (link), Institution, Overall Status, Date, etc. Filter for 'Pending'/'Partially Approved'. Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/requirements/warehouse`.
3.  **View Requirement Details (Warehouse Perspective):**
    - **UI:** Similar to Institution detail view, but focused on warehouse actions. Show requested vs approved quantities and statuses.
    - **API:** Fetch data using `GET /api/v1/requirements/:requirementId`.
4.  **Approve/Reject Requirement Items:**
    - **UI:** On the requirement detail view, provide controls next to each medicine item to:
      - Set Status ('Approved'/'Rejected').
      - Input `approvedQuantity` (enabled only if 'Approved', validated against requested).
      - Add a "Submit Approvals" button.
    - **State:** Track changes made to each item.
    - **API:** On submit, format the `medicines` update array and call `PATCH /api/v1/requirements/:requirementId/approve`.
    - **Feedback:** Update UI with new statuses/quantities. Show success/error.
5.  **Create Shipment:**
    - **UI:** On an approved/partially approved requirement detail view (where `logisticId` is null), add a "Create Shipment" button. Form/Modal to input `vehicles` array details (Vehicle #, Driver Name/Contact, `loadedAt`, `departedAt`). Optionally input `shipmentId`.
    - **State:** Manage vehicle form state.
    - **API:** On submit, call `POST /api/v1/logistics` with `requirementId` and `vehicles`.
    - **Feedback:** Show success/error. Update requirement view (status, show linked logisticId).
6.  **View Outgoing Shipments:**
    - **UI:** Page/table listing shipments originating from the warehouse. Columns: Shipment ID (link), Institution, Status, Date, etc. Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/logistics`.
7.  **View Shipment Details (Warehouse Perspective):**
    - **UI:** Similar to Institution detail view.
    - **API:** Fetch data using `GET /api/v1/logistics/:logisticId`.
8.  **Update Shipment Status:**
    - **UI:** On the shipment detail view, provide a way to update the `status` (e.g., dropdown: 'In Transit', 'Delivered'). Save button.
    - **API:** Call `PATCH /api/v1/logistics/:logisticId/status` with the new status.
    - **Feedback:** Update status display. Show success/error.

**III. Admin User Flow:**

1.  **View All Requirements:**
    - **UI:** Page/table listing _all_ requirements. Include filters (Warehouse, Institution, Status). Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/requirements/admin` (pass filter/pagination params).
2.  **View All Logistics:**
    - **UI:** Page/table listing _all_ shipments. Include filters (Warehouse, Institution, Status, Received Status). Implement pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/logistics/admin`.
3.  **View All Warehouse Stock:**
    - **UI:** Page/table listing _all_ warehouse stock records. Filters (Warehouse, Medicine). Pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/warehouse-stock/admin`.
4.  **View All Institution Stock:**
    - **UI:** Page/table listing _all_ institution stock records. Filters (Institution, Medicine). Pagination/sorting.
    - **API:** Fetch data using `GET /api/v1/institution-stock/admin`.
5.  **View Details (Read-Only):**
    - **UI:** Allow admins to navigate to detail views for requirements, logistics, and stock items. Ensure controls for modification (approval, status updates, receiving) are disabled or hidden for admins.
    - **API:** Use the standard `GET /:id` endpoints (e.g., `GET /api/v1/requirements/:reqId`, `GET /api/v1/logistics/:logId`). Backend authorization handles access.

This breakdown covers the main interactions needed on the frontend to utilize the backend API structure we've built. Remember to handle loading states and errors gracefully for a good user experience.
