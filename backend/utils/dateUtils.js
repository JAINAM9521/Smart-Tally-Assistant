exports.now = () => new Date();
exports.expired = date => new Date(date).getTime() < Date.now();
