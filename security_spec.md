# Security Specification — Asistente Docente Firestore Rules

## 1. Data Invariants & Master Source of Truth
- **Master Gate**: `/users/{userId}` is the root owner boundary; `/users/{userId}/courses/{courseId}` is the Master Source of Truth for `/users/{userId}/courses/{courseId}/students/{studentId}`.
- **Authentication & Verification**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
- **PII Isolation**: User profiles (`/users/{userId}`) contain email and displayName and are strictly `get` / `create` / `update` accessible only to `userId == request.auth.uid` (no `list` allowed on `/users`).
- **Relational Integrity**:
  - `Course.ownerId` MUST equal `userId` and `request.auth.uid` and is immutable after creation.
  - `Student.ownerId` MUST equal `userId` and `request.auth.uid` and is immutable after creation.
  - `Student.courseId` MUST equal `courseId`, and the parent course document MUST exist (via `existsAfter` / `getAfter` to support atomic `writeBatch` course+student saves) and have `ownerId == request.auth.uid`.
- **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`; `updatedAt` must equal `request.time` on every `create` and `update`.
- **Bounded Lists & Maps**: `units` (`list`, `size() >= 1 && size() <= 30`, first item `is string`), `extraColumns` (`list`, `size() <= 20`, if non-empty first item `is string`), `grades` (`map`, `size() <= 30`), `extras` (`map`, `size() <= 20`). All strings have strict `.size()` limits, and all doc IDs match `^[a-zA-Z0-9_-]+$` (`size() <= 128`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated read/write** on `/users/teacher1/courses/c1`: missing `request.auth`.
2. **Unverified email write** (`email_verified: false`) on `/users/teacher1`: must be rejected.
3. **Cross-user course impersonation** (`create` `/users/teacher2/courses/c1` while signed in as `teacher1`).
4. **Shadow/Ghost Field injection** on `Course` create (`{ ..., isAdmin: true }`): rejected by `keys().hasOnly(...)`.
5. **Owner spoofing in payload** (`create` `/users/teacher1/courses/c1` with `ownerId: 'teacher2'`): rejected by `ownerId == request.auth.uid`.
6. **Client-spoofed `createdAt` timestamp** (`createdAt: new Date(0)` instead of `serverTimestamp()`): rejected by `createdAt == request.time`.
7. **Immutable field tampering on update** (changing `createdAt` or `ownerId` on `/users/teacher1/courses/c1`).
8. **ID Poisoning** (doc ID `'../../../etc/passwd'` or 300-char junk string on `/courses/{courseId}`).
9. **Unbounded array / Denial-of-Wallet** (`units` with 50 items or invalid non-string item `[123]`, or 200KB string in `colegio`).
10. **Orphaned Student Write** (`create` `/users/teacher1/courses/nonexistent/students/s1` without parent course existing in DB/batch).
11. **Course ID mismatch** (`create` `/users/teacher1/courses/c1/students/s1` with `courseId: 'c2'`).
12. **Blanket User Enumeration / Unauthorized List** (`list` `/users` or `list` `/users/teacher2/courses`).
