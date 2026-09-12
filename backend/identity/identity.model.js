const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // SHA-256 hex digest of the CURRENT active bearer token - the raw token is
        // returned to the client exactly once (at creation, login, or signup) and
        // never stored, matching how an API key is normally handled: possession of
        // the raw value is the credential, and a leaked database dump doesn't hand
        // out usable tokens. Overwritten on every login and on logout (with a fresh
        // value nobody is ever given) - this is a single-active-session-per-account
        // model, not a session list; see identity.service.js's login/logout.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        // Absent (not `null`) for an anonymous-only user (the original,
        // still-fully-supported identity mode - see issueIdentity). Deliberately
        // no `default: null` here: Mongoose would then write a literal `email:
        // null` onto every anonymous user's document, and the sparse unique
        // index below only skips documents where the field is truly missing -
        // an explicit null still gets indexed, so a second anonymous user would
        // collide with the first on `dup key: { email: null }`. Set once via
        // signup, either on a brand-new account or upgraded in place onto an
        // existing anonymous user's _id, which is what lets pre-signup
        // Portfolio/Watchlist/Decision data carry over silently.
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },
        // bcrypt hash, null for an anonymous-only user (who has nothing to log in
        // with - anonymity IS their credential).
        passwordHash: {
            type: String,
            default: null,
        },
        // Push-delivery opt-ins - see backend/notifications/. Each channel is
        // an explicit opt-in, separate from merely having an email: a signed-up
        // user must still turn emailEnabled on. slackWebhookUrl/telegramChatId
        // are per-user because those channels have no single "Athena's own"
        // destination that would make sense for arbitrary users' personal
        // alerts (see backend/notifications/channels/*.channel.js).
        notificationPreferences: {
            emailEnabled: { type: Boolean, default: false },
            slackWebhookUrl: { type: String, default: null },
            telegramChatId: { type: String, default: null },
            digestEnabled: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

// Sparse so any number of anonymous users (email: null) never collide on this
// unique index - only real, signed-up emails need to be unique.
userSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
