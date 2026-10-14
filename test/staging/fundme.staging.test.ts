import { network } from "hardhat";
import { beforeEach, describe, it } from "node:test";
import { assert, expect } from "chai";
import { loadAndExecuteDeploymentsFromFiles } from "../../rocketh/environment.js";
import type { EthereumProvider } from "hardhat/types/providers";
import { Abi_FundMe } from "../../generated/abis/FundMe.js";
import { LOCKTIME } from "../../hardhat.config.user.js";

function setupFixtures(provider: EthereumProvider) {
    return {
        async deployAll() {
            const env = await loadAndExecuteDeploymentsFromFiles({
                provider: provider,
            })

            const fundMe = env.get<Abi_FundMe>("FundMe");

            return {
                env,
                fundMe,
                namedAccounts: env.namedAccounts,
                unnamedAccounts: env.unnamedAccounts,
            }
        }
    }
}

const { viem, ethers, provider } = await network.create();
const { deployAll } = setupFixtures(provider);

const { chainId } = await ethers.provider.getNetwork();
const isSepolia = chainId === 11155111n;

describe("test fundme contract", { skip: !isSepolia }, async function() {
    let env: any;
    let fundMe: any;
    let fundMeContract: any;
    let publicClient: any;
    let namedAccounts: any;

    beforeEach(async function() {
        const fixture = await deployAll();
        fundMe = fixture.fundMe;
        namedAccounts = fixture.namedAccounts;
        fundMeContract = await viem.getContractAt("FundMe", fundMe.address);
        publicClient = await viem.getPublicClient();
    })

    // test fund and getFund succussfully
    it("fund and getFund succussfully", async function() {
        // make sure target reached and sure tx completed
        const fundHash = await fundMeContract.write.fund({ value: ethers.parseEther("0.05")});
        const fundReceipt = await publicClient.waitForTransactionReceipt({hash: fundHash});
        assert.equal(fundReceipt.status, "success");

        // make sure window closed
        await new Promise(resolve => setTimeout(resolve, Number(LOCKTIME)*1000));

        // make sure tx completed
        const getFundHash = await fundMeContract.write.getFund()
        const getFundReceipt = await publicClient.waitForTransactionReceipt({hash: getFundHash});
        assert.equal(getFundReceipt.status, "success");

        // check result
        const balance = await publicClient.getBalance({ address: fundMe.address }); 
        assert.equal(balance, 0n);
    })

    it("fund and reFund succussfully", async function () {
        // make sure target not reached and sure tx completed
        const fundHash = await fundMeContract.write.fund({ value: ethers.parseEther("0.01")});
        const fundReceipt = await publicClient.waitForTransactionReceipt({hash: fundHash});
        assert.equal(fundReceipt.status, "success");

        // make sure window closed
        await new Promise(resolve => setTimeout(resolve, Number(LOCKTIME)*1000));

        // make sure tx completed
        const reFundHash = await fundMeContract.write.reFund()
        const reFundReceipt = await publicClient.waitForTransactionReceipt({hash: reFundHash});
        assert.equal(reFundReceipt.status, "success");

        // check result
        const amount = await fundMeContract.read.fundersToAmount([namedAccounts.deployer]);
        await assert.equal(amount, 0n);
    })
})