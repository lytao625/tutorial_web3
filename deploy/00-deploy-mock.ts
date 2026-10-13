import hre from 'hardhat'
import {deployScript, artifacts} from '../rocketh/deploy.js';

import {DECIMAL, INITIAL_FEED_ANSWER} from "../hardhat.config.user.js";

export default deployScript(
    async (env) => {
        const {deployer} = env.namedAccounts;
        if (env.network.chain.id == 11155111) {
            console.log(`Deploying MockV3Aggregator on chain: ${env.network.chain.name}, skiping deployment`)
        } else {
            console.log(`Deploying MockV3Aggregator on chain: ${env.network.chain.name}`)
            await env.deploy('MockV3Aggregator', {
                artifact: artifacts.MockV3Aggregator,
                account: deployer,
                args: [DECIMAL, INITIAL_FEED_ANSWER],
            });
        }
    },
    {
        tags: ['MockV3Aggregator', 'mock', 'all'],
    },
);