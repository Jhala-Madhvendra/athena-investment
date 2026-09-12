/**
 * Snapshot Service
 *
 * Owns read-only share links. A snapshot's `payload` is whatever the client
 * already had rendered (a portfolio's holdings+summary, or a DCF result) -
 * this module never fetches or recomputes anything, it only stores and
 * later returns exactly what was captured at creation time. See
 * snapshot.model.js for why `payload` is a point-in-time capture, not a
 * live view.
 *
 * TOKEN HANDLING mirrors identity.service.js exactly: a random raw token is
 * generated, only its hash is persisted, and the raw value is returned to
 * the caller exactly once (at creation) - never stored, never re-derivable
 * from the database.
 */

const crypto = require("crypto");
const Snapshot = require("./snapshot.model");

const TOKEN_BYTES = 32;

class SnapshotNotFoundError extends Error {
    constructor() {
        super("Snapshot not found, or this link is no longer available.");
        this.name = "SnapshotNotFoundError";
        this.statusCode = 404;
    }
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * @param {string} userId
 * @param {{type: string, label: string|null, payload: object}} input
 * @returns {Promise<{snapshot: object, token: string}>}
 */
const createSnapshot = async (userId, { type, label, payload }) => {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const snapshot = await Snapshot.create({ userId, type, label, payload, tokenHash: hashToken(token) });

    return { snapshot, token };
};

/** Never selects `payload` or `tokenHash` - a list of a user's own share links exposes only what's needed to manage them. */
const listSnapshots = async (userId) =>
    Snapshot.find({ userId }).select("type label createdAt").sort({ createdAt: -1 }).lean();

const deleteSnapshot = async (userId, id) => {
    const snapshot = await Snapshot.findOneAndDelete({ _id: id, userId });

    if (!snapshot) {
        throw new SnapshotNotFoundError();
    }

    return snapshot;
};

/**
 * Resolves a raw share token (from a public /share/:token URL) to its
 * payload. Never returns `userId` - the recipient has no reason to learn
 * who created the link.
 * @param {string} rawToken
 */
const getSharedSnapshot = async (rawToken) => {
    const snapshot = await Snapshot.findOne({ tokenHash: hashToken(rawToken) })
        .select("type label payload createdAt")
        .lean();

    if (!snapshot) {
        throw new SnapshotNotFoundError();
    }

    return { type: snapshot.type, label: snapshot.label, payload: snapshot.payload, createdAt: snapshot.createdAt };
};

module.exports = {
    createSnapshot,
    listSnapshots,
    deleteSnapshot,
    getSharedSnapshot,
    SnapshotNotFoundError,
};
