const mongoose = require("mongoose");
const savedScenarioService = require("./savedScenario.service");
const { validateSavedScenarioRequest } = require("./savedScenario.validator");
const { sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const createSavedScenario = async (req, res) => {
    const validation = validateSavedScenarioRequest(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid saved scenario request.", errors: validation.errors });
    }

    try {
        const savedScenario = await savedScenarioService.createSavedScenario(req.userId, validation.normalized);
        return res.status(201).json({ savedScenario });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const listSavedScenarios = async (req, res) => {
    try {
        const savedScenarios = await savedScenarioService.listSavedScenarios(req.userId);
        return res.status(200).json({ savedScenarios });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deleteSavedScenario = async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "A valid saved scenario id is required." });
    }

    try {
        await savedScenarioService.deleteSavedScenario(req.userId, id);
        return res.status(200).json({ message: "Saved scenario removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { createSavedScenario, listSavedScenarios, deleteSavedScenario };
