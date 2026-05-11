# 📦 Lunatics Shared

> **Bounded Context: Ubiquitous Language & Shared Models**

The `shared` workspace contains the core TypeScript models, schemas, and utility functions used throughout the Lunatics monorepo. It acts as the "source of truth" for the system's domain logic.

---

## 🎯 Context & Purpose

In a monorepo architecture, maintaining consistency between the frontend (`web`) and backend (`functions`) is critical. The `shared` package ensures that:
1.  **Data Schemas** are unified.
2.  **API Interfaces** are strictly typed.
3.  **Domain Logic** is not duplicated.

---

## 🏗 Domain Model

- **Models:** Interface definitions for Crimes, Articles, Moon Phases, and Statistics.
- **Utils:** Common validation and formatting logic (e.g., date transformations, lunar calculations).

---

## 🛠 Tech Stack

- **Language:** TypeScript
- **Build System:** `tsc` (TypeScript Compiler)

---

## 🚀 Usage

### Development
Any changes made to the `shared` package must be built to be visible to the `web` and `functions` packages.

```bash
pnpm run build
```

### Integration
- **Web:** Consumed via `pnpm workspace` dependency.
- **Functions:** Consumed via a local file copy workaround (`shared-local`) to support Firebase Gen 2 deployment constraints.

---

## 📜 Operational Rules

- **Strict Typing:** Avoid `any` at all costs. All data structures entering or leaving the system must have a corresponding interface defined here.
- **Stability:** Changes to this package have cascading effects. Ensure all workspace projects are tested after modifying `shared`.

---

**Antigravity Architect** - *Type safety, domain consistency.*
