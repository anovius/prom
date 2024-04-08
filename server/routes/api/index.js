const express = require("express");
const UserController = require("./user.js");
const WalletController = require("./wallet.js");
const FeedController = require("./feed.js");
const WatchlistController = require("./watchlist.js");
const NotificationController = require("./notification.js");
const TransactionController = require("./transaction.js");
const TokenController = require("./token.js");
const UploadController = require("./upload.js");
const ChatController = require("./chat.js");
const OrderController = require("./order.js");

const router = express.Router();

router.use("/user", UserController);
router.use("/wallet", WalletController);
router.use("/feed", FeedController);
router.use("/watchlist", WatchlistController);
router.use("/notification", NotificationController);
router.use("/transaction", TransactionController);
router.use("/token", TokenController);
router.use("/order", OrderController);
router.use("/upload", UploadController);
router.use("/chat", ChatController);

module.exports = router;
