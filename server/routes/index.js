const express = require("express");
const api = require("./api/index.js");

const router = express.Router();

router.use("/api", api);

module.exports = router;
