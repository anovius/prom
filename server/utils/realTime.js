exports.emitEvent = (event, data = {}) => {
	// console.log("emitEvent", event, data);
	prometheusSocket.emit(event, data);
};
