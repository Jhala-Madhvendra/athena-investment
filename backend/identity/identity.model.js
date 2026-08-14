const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // SHA-256 hex digest of the bearer token - the raw token is returned to the
        // client exactly once (at creation) and never stored, matching how an API
        // key is normally handled: possession of the raw value is the credential,
        // and a leaked database dump doesn't hand out usable tokens.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
