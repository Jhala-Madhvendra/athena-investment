const mongoose = require("mongoose");

/**
 * A read-only, point-in-time share link. `payload` is captured once at
 * creation time - never re-fetched or re-computed for the recipient, who
 * has no Athena account and no auth token to fetch anything live with.
 * `tokenHash` mirrors identity.model.js's own tokenHash discipline: the raw
 * share token is returned to the client exactly once (at creation) and
 * never stored, so a leaked collection dump can't hand out usable links.
 */
const snapshotSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["portfolio", "dcf"],
        },
        label: {
            type: String,
            trim: true,
            maxlength: 100,
            default: null,
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
    },
    { timestamps: true }
);

snapshotSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Snapshot", snapshotSchema);
