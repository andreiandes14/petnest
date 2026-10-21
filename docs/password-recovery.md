# Security-question password recovery

## Workflow

- Registration requires an answer to **Who is your favorite person?** The server trims leading/trailing whitespace, normalizes Unicode and case, and stores only a salted scrypt hash.
- Login → Forgot Password opens a three-field modal: Email, security answer, New Password. It sends one request to `POST /api/auth/password-recovery/reset`.
- A correct answer for an active enrolled account permits a password update using the existing password hasher. The response is **Password reset successfully. You can now log in.**
- No email service, verification code, OTP, reset link, or follow-up verification screen is used. No email-service environment variables are required by this feature.

## Limits and protections

- MongoDB `passwordRecoveryLimits` persists per-email attempt windows and one-hour lockouts across refreshes, restarts and API instances. Five failed verifications within the window lock recovery for one hour from the fifth failure.
- An atomic per-email lease serializes attempts; the password/answer snapshot is checked again during the update to reject stale concurrent changes.
- `passwordRecoveryIpLimits` applies an additional 30-request hourly IP limit. Identifiers are HMAC digests rather than raw email/IP values. The application uses Express's resolved IP instead of trusting arbitrary forwarded-IP headers.
- Unknown, inactive, unenrolled, incorrect-answer and locked accounts return the same generic failure.
- A dummy hash verification also runs for unknown or unenrolled accounts.
- New passwords must contain at least eight characters; input lengths are bounded. Answers and passwords are never stored as plaintext or added to logs/public responses/admin projections.
- Reset invalidates existing sessions. A password-change timestamp also rejects old sessions when physical session cleanup is interrupted.

Security questions alone are vulnerable to guessing and personal-information discovery. Rate limiting reduces automated guessing but does **not** provide strong proof of account ownership. This implementation intentionally follows the requested security-question-only flow.

## Existing accounts

Enrolled customers and providers use the same verification rules. Accounts without a stored answer cannot reset through this workflow. Existing signed-in customers/providers can set an answer through their account security settings by supplying their current password. No default answers are assigned. Accounts unable to sign in and lacking an answer need an independently authorized support process; this implementation does not create a recovery bypass. Admin accounts are excluded.

No existing account data is migrated or reset automatically.

## Validation

Automated tests exercise normalized answers, registration hashing/privacy, old/new password verification, lockout and expiry, generic failures, unenrolled/inactive accounts, provider recovery, concurrent submissions, IP throttling, session invalidation, and the three-field modal. Tests use mocked MongoDB and the actual existing password hasher; live account password changes are not performed.
