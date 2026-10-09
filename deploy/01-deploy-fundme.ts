import {deployScript, artifacts} from '../rocketh/deploy.js';

import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.js";

export default deployScript(
    async (env) => {
        const {deployer} = env.namedAccounts;
        console.log(`This is a deploy function, with account: ${deployer}`);

        await env.deploy('FundMe', {
            artifact: artifacts.FundMe,
            account: deployer,
            args: [SEPOLIA_ETHUSD_DATAFEED, LOCKTIME],
        });
    },
    {
        tags: ['FundMe'],
    },
);