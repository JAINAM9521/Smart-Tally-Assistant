exports.sendVerificationEmail = async ({ email, token }) => { if (!process.env.EMAIL_HOST) return { development: true, token }; return { sent: true, email, token }; };
