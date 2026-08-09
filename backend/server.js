const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const connectDB = require("./config/db");
const companyRoutes = require("./routes/company.routes");
const financialsRoutes = require("./financials/financials.routes");
const ratioRoutes = require("./ratio/ratio.routes");
const analysisRoutes = require("./analysis/analysis.routes");
const marketRoutes = require("./market/market.routes");
const valuationRoutes = require("./valuation/valuation.routes");

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/company", companyRoutes);
app.use("/api/financials", financialsRoutes);
app.use("/api/ratios", ratioRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/valuation", valuationRoutes);

app.get("/", (req, res) => {
    res.send("Backend Running...");
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: err.message || "Internal Server Error",
        ...(err.errors ? { errors: err.errors } : {}),
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
