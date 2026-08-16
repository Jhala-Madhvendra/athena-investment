/**
 * Regression test for the CORS-preflight incident described in
 * config/corsOptions.js: Sprint 11 added PATCH routes without adding
 * "PATCH" to the CORS-allowed methods list, which silently broke both of
 * them from any real browser (mocked-fetch unit tests never exercise real
 * CORS preflight behavior, so nothing caught it for several sprints).
 *
 * Rather than pin down this one incident, this test scans every
 * `*.routes.js` file's actually-registered Express methods and asserts
 * every one of them is covered by ALLOWED_CORS_METHODS - so adding a new
 * route with a method nobody thought to CORS-allow fails a fast, obvious
 * unit test instead of silently breaking in a browser weeks later.
 */

const fs = require("fs");
const path = require("path");
const { ALLOWED_CORS_METHODS } = require("../config/corsOptions");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set(["node_modules", "__tests__"]);

/** Recursively finds every *.routes.js file under the backend, skipping node_modules/__tests__. */
const findRouteFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const routeFiles = [];

    entries.forEach((entry) => {
        if (EXCLUDED_DIRS.has(entry.name)) {
            return;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            routeFiles.push(...findRouteFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".routes.js")) {
            routeFiles.push(fullPath);
        }
    });

    return routeFiles;
};

/** Every HTTP method registered on an Express Router, e.g. {"/routes/company.routes.js": ["get", "post"]}. */
const collectMethodsByFile = () => {
    const methodsByFile = {};

    findRouteFiles(BACKEND_ROOT).forEach((filePath) => {
        const router = require(filePath);
        const methods = new Set();

        (router.stack || []).forEach((layer) => {
            if (layer.route?.methods) {
                Object.keys(layer.route.methods).forEach((method) => methods.add(method.toUpperCase()));
            }
        });

        if (methods.size > 0) {
            const relativePath = path.relative(BACKEND_ROOT, filePath).split(path.sep).join("/");
            methodsByFile[relativePath] = [...methods].sort();
        }
    });

    return methodsByFile;
};

describe("CORS methods cover every registered route", () => {
    it("lists at least one route file (sanity check that discovery itself works)", () => {
        const methodsByFile = collectMethodsByFile();
        expect(Object.keys(methodsByFile).length).toBeGreaterThan(5);
    });

    it("includes PATCH (the exact method Sprint 11's alert routes needed)", () => {
        expect(ALLOWED_CORS_METHODS).toContain("PATCH");
    });

    it("covers every HTTP method actually used by any mounted *.routes.js file", () => {
        const methodsByFile = collectMethodsByFile();
        const uncovered = [];

        Object.entries(methodsByFile).forEach(([file, methods]) => {
            methods.forEach((method) => {
                if (!ALLOWED_CORS_METHODS.includes(method)) {
                    uncovered.push(`${file}: ${method}`);
                }
            });
        });

        expect(uncovered).toEqual([]);
    });

    it("specifically confirms PATCH /api/alerts/:id/read and /:id/dismiss are covered", () => {
        const methodsByFile = collectMethodsByFile();
        const alertMethods = methodsByFile["alerts/alert.routes.js"];

        expect(alertMethods).toContain("PATCH");
        expect(ALLOWED_CORS_METHODS).toEqual(expect.arrayContaining(alertMethods));
    });
});
