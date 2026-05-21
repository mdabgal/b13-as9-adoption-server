const { betterAuth } = require("better-auth");

const auth = betterAuth({
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENTID,
            clientSecret: process.env.GOOGLE_SECRET,
        },
    },
});

module.exports = { auth };