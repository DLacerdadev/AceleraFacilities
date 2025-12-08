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

The authentication system includes single-session control, invalidating previous sessions via WebSocket when a user logs in from a new device. Performance optimizations include database indexing, parallel query execution, and real-time data reporting. Photo uploads are optimized with automatic compression. An offline-first Android APK is supported by a comprehensive sync infrastructure using IndexedDB.

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