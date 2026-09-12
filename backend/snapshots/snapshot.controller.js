const snapshotService = require("./snapshot.service");
const { validateCreateRequest } = require("./snapshot.validator");
const { sendServiceError } = require("../utils/httpErrors");

const create = async (req, res) => {
    const validation = validateCreateRequest(req.body);

    if (!validation.isValid) {
        return res.status(422).json({ message: "Snapshot failed validation.", errors: validation.errors });
    }

    try {
        const { snapshot, token } = await snapshotService.createSnapshot(req.userId, validation.normalized);
        return res.status(201).json({
            id: snapshot._id,
            type: snapshot.type,
            label: snapshot.label,
            createdAt: snapshot.createdAt,
            token,
        });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const list = async (req, res) => {
    try {
        const snapshots = await snapshotService.listSnapshots(req.userId);
        return res.status(200).json({ snapshots });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const remove = async (req, res) => {
    try {
        await snapshotService.deleteSnapshot(req.userId, req.params.id);
        return res.status(204).send();
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getShared = async (req, res) => {
    try {
        const shared = await snapshotService.getSharedSnapshot(req.params.token);
        return res.status(200).json(shared);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { create, list, remove, getShared };
