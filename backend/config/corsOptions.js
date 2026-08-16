/**
 * HTTP methods the app-wide CORS policy (server.js) allows a real browser
 * to call cross-origin. Every mounted route's HTTP method must appear here
 * - a browser preflights any non-simple request (PATCH always is; POST/PUT
 * with a JSON body are too) with an OPTIONS request, and rejects the real
 * call before it ever reaches Express if the method isn't listed in the
 * preflight response's Access-Control-Allow-Methods header.
 *
 * This is a real incident, not a hypothetical: Sprint 11 added
 * PATCH /api/alerts/:id/read and /:id/dismiss without adding "PATCH" here,
 * which silently broke both from any real browser for several sprints -
 * every unit test used a mocked fetch, which never exercises actual CORS
 * preflight behavior, so nothing caught it. See
 * backend/__tests__/corsMethods.test.js, which scans every *.routes.js
 * file's actual registered methods against this list specifically to
 * catch a repeat of that failure mode.
 */
const ALLOWED_CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

module.exports = { ALLOWED_CORS_METHODS };
