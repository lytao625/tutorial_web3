import hre from 'hardhat';
import {deployScript, artifacts} from '../rocketh/deploy.js';

import {LOCKTIME, SEPOLIA_ETHUSD_DATAFEED} from "../hardhat.config.user.js";
import { Abi_MockV3Aggregator } from '../generated/abis/MockV3Aggregator.js';

export default deployScript(
    async (env) => {
        const {deployer} = env.namedAccounts;

        console.log(`Deploying FundMe on chain: ${env.network.chain.name}`)

        let datafeedAddr: string;
        if (env.network.chain.id == 11155111) {
            datafeedAddr = SEPOLIA_ETHUSD_DATAFEED;
        } else {
            const mock = env.get<Abi_MockV3Aggregator>("MockV3Aggregator");
            datafeedAddr = mock.address;
        }

        const fundMe = await env.deploy('FundMe', {
            artifact: artifacts.FundMe,
            account: deployer,
            args: [datafeedAddr, LOCKTIME],
        });

        console.log(`FundMe contract address: ${env.get('FundMe').address}`)

        if (env.name == 'sepolia') {
            console.log("Verifying on etherscan ...");
            await hre.tasks.getTask("verify").run({
                address: env.get('FundMe').address,
                constructorArgs: [SEPOLIA_ETHUSD_DATAFEED, String(LOCKTIME)],
            });
        } else {
            console.log(`env is ${env.name}, verification skipped`)
        }
    },
    {
        tags: ['FundMe', 'all'],
        dependencies: ['MockV3Aggregator']
    },
);