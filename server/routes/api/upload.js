const router = require("express").Router();
let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");

let { BACKEND_URL } = require("../../config");
const multer = require("../../utils/multer");
const cpUpload = multer.fields([{ name: "file", maxCount: 1 }]);

router.post("/", cpUpload, function (req, res, next) {
	try {
		console.log(req.files, "req.files");
		return next(new OkResponse({ url: `${BACKEND_URL}/uploads/${req.files["file"][0].filename}` }));
	} catch (error) {
		console.log(error);
	}
});

module.exports = router;
