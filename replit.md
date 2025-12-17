# Acelera it - Full Facilities - Project Summary

## Overview
Acelera it Full Facilities is a modular platform for facilities management, specifically for Clean and Maintenance operations. It includes web administration and mobile applications for scheduling, work order management, QR code-based task execution, and public service requests. The platform supports multi-company, multi-site, and multi-zone environments, offering real-time analytics focused on efficiency, cost reduction, and productivity. The business vision is to provide a comprehensive solution that significantly enhances operational workflows in facilities management, with ambitions for market leadership in integrated facilities platforms.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The system features an enterprise-grade, corporate design using `shadcn/ui` with Radix UI and Tailwind CSS, emphasizing professionalism. It includes module-specific colors (blue for Clean, orange for Maintenance), responsive design, a corporate SaaS aesthetic for pre-login pages, custom branding, Lucide React icons, Framer Motion animations, and full-width layouts.

### Technical Implementations
The frontend uses React, TypeScript, Wouter for routing, and TanStack Query for data management. The backend is an Express.js server in TypeScript with Drizzle ORM for PostgreSQL. Key features include a hierarchical multi-tenancy model with role-based access control, comprehensive equipment management, QR code-based task execution, and robust work order management with virtual calendars and automated scheduling. Authentication supports Microsoft SSO and email/password, secured with JWT and Bcrypt. An AI integration configuration page is present, with chat assistant functionality under development. A TV Mode Dashboard provides real-time, gamified metrics. User management offers full CRUD and custom role assignments, including a granular permission system with user type validation and frontend filtering, and enhanced shift-based scheduling with weekday filtering. A custom roles system automatically creates three default client roles upon customer provisioning: "Operador," "Cliente," and "Administrador," associated with the customer's company.

The system implements a fully reactive model with WebSockets for instant updates across all resources. The WebSocket server runs on the same HTTP server at `/ws` and uses JWT authentication. Data changes trigger backend notifications to connected clients, which then invalidate the React Query cache and reload affected data, ensuring immediate updates without manual page refreshes. Real-time broadcasted resources include Work Orders, Customers, Sites, Zones, Users, Roles, Equipment, Maintenance Plans, Checklists, Parts, QR Code Points, Dashboard Goals, AI Integrations, and Part Movements.

A comprehensive Parts Inventory module is integrated with Work Orders and Maintenance Plans. It supports CRUD operations for parts, tracks stock movements, provides low-stock alerts, integrates with Work Orders for part selection and availability validation, and automatically deducts stock upon Work Order completion.

An optional "Terceiros" (Third Party) submodule is available, controlled by the `thirdPartyEnabled` flag per customer (default: false for backward compatibility). The `requireThirdPartyEnabled` middleware guards all third-party related routes, ensuring existing customers are not impacted unless the module is explicitly enabled. The core entity is `ThirdPartyCompany`, which represents external vendors linked to a single customer. Key features include: site/zone access control via `allowedSites`/`allowedZones` arrays, asset visibility modes (ALL or CONTRACT_ONLY), user limits for billing, and contract date tracking for future billing integration.

The third-party module implements a three-tier user hierarchy with strict access control:
- **THIRD_PARTY_MANAGER**: Full control over their company's users, work orders, and reports
- **THIRD_PARTY_TEAM_LEADER**: Can view/create operators only, execute work orders, view reports
- **THIRD_PARTY_OPERATOR**: Mobile-only access for work order execution

Users table extended with `thirdPartyCompanyId` and `thirdPartyRole` fields. New middlewares enforce hierarchical permissions: `requireThirdPartyUser`, `requireThirdPartyRole(minRole)`, and `validateThirdPartyUserCreation` for role-based user creation validation. Dedicated permissions added: `third_party_view/create/edit/delete`, `third_party_users_*`, `third_party_workorders_*`, and `third_party_reports_view`.

A comprehensive data isolation system ensures third-party users can only access authorized resources. The `ThirdPartyContext` middleware loads company configuration (allowed sites, zones, asset visibility mode) and validates all requests. Key isolation features:
- **Customer validation**: Third parties can only access their contracted customer's data
- **Site filtering**: Access restricted to `allowedSites` array from ThirdPartyCompany
- **Zone filtering**: Access restricted to `allowedZones` array from ThirdPartyCompany
- **Asset visibility**: Two modes via `assetVisibilityMode` - `ALL` (all assets in allowed zones) or `CONTRACT_ONLY` (only assets with company ID in `contractedThirdPartyIds` array)

Helper functions (`getFilteredSitesForThirdParty`, `getFilteredZonesForThirdParty`, `getFilteredEquipmentForThirdParty`) automatically apply isolation filters. The `validateThirdPartyDataAccess` function provides centralized access validation for any resource.

Work Orders support execution by third parties through dedicated fields: `executedByType` (INTERNAL or THIRD_PARTY), `thirdPartyCompanyId`, `thirdPartyTeamId`, and `thirdPartyOperatorId`. This enables tracking whether a work order is executed by internal staff or a third-party company, with full traceability of the executing team and operator.

The authentication system includes single-session control, invalidating previous sessions via WebSocket when a user logs in from a new device. Performance optimizations include database indexing, parallel query execution, and real-time data reporting. Photo uploads are optimized with automatic compression. An offline-first Android APK is supported by a comprehensive sync infrastructure using IndexedDB.

An immutable audit logging system tracks all work order lifecycle events in the `work_order_audit_logs` table. The `WorkOrderAuditService` (at `server/services/work-order-audit.ts`) provides helper methods for logging: creation, updates, status changes, comments, evaluations, execution start/pause/resume/complete, reopening, and approval/rejection. Each log entry captures the user, user type (platform_user, customer_user, third_party_user), customer ID, third-party company ID (if applicable), timestamp, action type, changes (before/after values), and metadata (IP address, user agent, source). Logs are append-only with no update or delete operations, ensuring full traceability and compliance. The endpoint `GET /api/work-orders/:workOrderId/audit-logs` retrieves the complete audit history for a work order with proper tenant isolation.

### System Design Choices
The project is configured for the Replit cloud environment, with automated PostgreSQL provisioning and a modular design for future expansion. It includes an adaptive subdomain-based branding system that dynamically applies client branding (logos and module colors) based on the subdomain, with robust fallback mechanisms and asset serving. This multi-tenant system detects subdomains from query parameters, hostname, or localStorage, persisting the subdomain across sessions for dynamic branding and automatic client context setup post-login.

## External Dependencies

### Database & Storage
- PostgreSQL (Neon hosting)
- Drizzle ORM
- Drizzle Kit

### UI Components & Styling
- Radix UI
- shadcn/ui
- Tailwind CSS
- Lucide React
- React Icons
- Framer Motion

### Mobile (Android APK - Expo React Native)
- Expo SDK 54 (React Native 0.81, React 19)
- Expo SQLite v16
- @react-native-community/netinfo
- Expo Secure Store v15
- Expo Image Picker v17
- Expo Image Manipulator v14
- Expo File System v19
- TypeScript 5.8

### Frontend Framework
- React 18
- TypeScript
- Vite
- Wouter
- TanStack Query
- React Hook Form
- Zod

### Backend & API
- Express.js
- TypeScript
- WebSocket (ws)
- Passport.js
- Passport Local
- OpenID Client
- JWT
- Bcrypt.js

### Security & Middleware
- Helmet.js
- CORS
- Express Rate Limit
- Express Session
- Connect PG Simple

### AI & Chat
- Groq SDK
- Google Generative AI
- OpenAI SDK
- Zod

### Utilities
- date-fns
- nanoid
- QRCode
- QR Scanner
- jsPDF
- jsPDF AutoTable
- html2canvas
- XLSX
- Memoizee