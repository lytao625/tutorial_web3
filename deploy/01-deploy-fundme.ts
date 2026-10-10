import hre from 'hardhat';
import {deployScript, artifacts} from '../rocketh/deploy.js';

import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.js";
import { Abi_MockV3Aggregator } from '../generated/abis/MockV3Aggregator.js';

export default deployScript(
    async (env) => {
        const {deployer} = env.namedAccounts;

        console.log(`Deploying on chain: ${env.network.chain.name}, with account: ${deployer}`)

        let datafeedAddr: string;
        if (env.network.chain.id == 11155111) {
            datafeedAddr = SEPOLIA_ETHUSD_DATAFEED;
        } else {
            const mock = env.get<Abi_MockV3Aggregator>("MockV3Aggregator");
            datafeedAddr = mock.address;
        }

        await env.deploy('FundMe', {
            artifact: artifacts.FundMe,
            account: deployer,
            args: [datafeedAddr, LOCKTIME],
        });
    },
    {
        tags: ['FundMe'],
        dependencies: ['MockV3Aggregator']
    },
);