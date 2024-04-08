function calculateAveragePrice(obj) {
	let amount = 0;
	let prices = 0;
	for (let addressKey in obj) {
		if (obj.hasOwnProperty(addressKey)) {
			if (!Array.isArray(obj[addressKey])) continue;
			if (obj[addressKey].length === 0) continue;
			for (let nestedObj of obj[addressKey]) {
				if (!nestedObj.price) {
					continue;
				}
				amount += nestedObj.amount;
				prices += nestedObj.amount * nestedObj.price;
			}
			const averagePrice = prices / amount;
			obj[addressKey] = averagePrice;
			amount = 0;
			prices = 0;
		}
	}
	// console.log(obj);
	return obj;
}

module.exports = calculateAveragePrice;
