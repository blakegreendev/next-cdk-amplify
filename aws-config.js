const awsconfig = {
    Auth: {
        identityPoolId: `${process.env.NEXT_APP_IDENTITY_POOL_ID}`,
        region: `${process.env.NEXT_APP_REGION}`,
        identityPoolRegion: `${process.env.NEXT_APP_REGION}`,
        userPoolId: `${process.env.NEXT_APP_USER_POOL_ID}`,
        userPoolWebClientId: `${process.env.NEXT_APP_USER_POOL_CLIENT_ID}`,
    }
};

export default awsconfig;