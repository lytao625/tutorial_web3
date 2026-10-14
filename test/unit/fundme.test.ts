import { network } from "hardhat";
import { beforeEach, describe, it } from "node:test";
import { assert, expect } from "chai";
import { loadAndExecuteDeploymentsFromFiles } from "../../rocketh/environment.js";
import type { EthereumProvider } from "hardhat/types/providers";
import { Abi_FundMe } from "../../generated/abis/FundMe.js";
import type { Abi_MockV3Aggregator } from "../../generated/abis/MockV3Aggregator.js";
import { SEPOLIA_ETHUSD_DATAFEED } from "../../hardhat.config.user.js";
import { LOCKTIME } from "../../hardhat.config.user.js";

function setupFixtures(provider: EthereumProvider) {
    return {
        async deployAll() {
            const env = await loadAndExecuteDeploymentsFromFiles({
                provider: provider,
            })

            const fundMe = env.get<Abi_FundMe>("FundMe");
            const mockV3Aggregator = env.get<Abi_MockV3Aggregator>("MockV3Aggregator");

            return {
                env,
                fundMe,
                mockV3Aggregator,
                namedAccounts: env.namedAccounts,
                unnamedAccounts: env.unnamedAccounts,
            }
        }
    }
}

const { viem, ethers, provider, networkHelpers } = await network.create();
const { deployAll } = setupFixtures(provider);

const { chainId } = await ethers.provider.getNetwork();

(chainId === 11155111n)
?describe.skip()
:describe("test fundme contract", async function() {
    let env: any;
    let fundMe: any;
    let mockV3Aggregator: any;
    let namedAccounts: any;
    let fundMeContract: any;
    let mockContract: any;
    let fundMeSecond: any;
    beforeEach(async function() {
        const fixture = await networkHelpers.loadFixture(deployAll);
        env = fixture.env;
        fundMe = fixture.fundMe;
        mockV3Aggregator = fixture.mockV3Aggregator
        namedAccounts = fixture.namedAccounts;
        mockContract = await viem.getContractAt("MockV3Aggregator", fixture.mockV3Aggregator.address);
        fundMeContract = await viem.getContractAt("FundMe", fixture.fundMe.address);
        const secondClient = await viem.getWalletClient(namedAccounts.admin);
        fundMeSecond = await viem.getContractAt("FundMe", fixture.fundMe.address, {client: { wallet: secondClient}});
    })

    // unit test for state variable
    it("test if the owner is msg.sender", async function() {
        const owner = await env.read(fundMe, {functionName: "owner"});
        assert.equal(owner.toLowerCase(), namedAccounts.deployer.toLowerCase());
    })

    it("test if the datafeed value is assigned correctly", async function() {
        const datafeed = await env.read(fundMe, {functionName: "dataFeed"});
        assert.equal(datafeed.toLowerCase(), mockV3Aggregator.address.toLowerCase());
    })

    // unit test for fund function
    it("window open, value is smaller than minimum, fund failed", async function() {
        // value is smaller than minimum 
        await viem.assertions.revertWith(
            fundMeContract.write.fund({ value: 1n }),
            "More eth needed",
        );
    })

    it("window closed, value greater than minimum, fund failed", async function() {
        // make sure the window is closed.
        await networkHelpers.time.increase(200);
        await networkHelpers.mine();
        // value is greater than minimum 
        await viem.assertions.revertWith(
            fundMeContract.write.fund({ value: ethers.parseEther("0.1") }),
            "Fund window is closed.",
        );
    })

    it("window open, value greater than minimum, fund success", async function() {
        await fundMeContract.write.fund({ value: ethers.parseEther("0.01")})
        const balance = await fundMeContract.read.fundersToAmount([namedAccounts.deployer]);
        await assert.equal(balance, ethers.parseEther("0.01"));
    })

    // unit test for getFund function
    it("window open, fund target reached, getFund failed", async function() {
        await viem.assertions.revertWith(
            fundMeContract.write.getFund(),
            "Window is not closed.",
        );
    })

    it("window closed, fund target not reached, getFund failed", async function() {
        await fundMeContract.write.fund({ value: ethers.parseEther("0.01")})
        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();
        await viem.assertions.revertWith(
            fundMeContract.write.getFund(),
            "Target is not reached.",
        );
    })

    it("window closed, fund target reached, not owner, getFund failed", async function() {
        // fund enough value.
        await fundMeContract.write.fund({ value: ethers.parseEther("1")})
        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();
        await viem.assertions.revertWith(
            fundMeSecond.write.getFund(),
            "This function can only be called by owner.",
        );
    })

    it("window closed, fund target reached, owner, getFund success", async function() {
        // fund enough value.
        await fundMeContract.write.fund({ value: ethers.parseEther("1")})
        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();

        const txHash = await fundMeContract.write.getFund();

        await viem.assertions.emitWithArgs(
            txHash, 
            fundMeContract, 
            "getFundEvent", 
            [namedAccounts.deployer, ethers.parseEther("1")]
        );
    })

    // unit test for reFund function
    it("window open, fund target not reached, reFund failed", async function() {
        await viem.assertions.revertWith(
            fundMeContract.write.reFund(),
            "Window is not closed.",
        );
    })

    it("window closed, fund target reached, reFund failed", async function() {
        // fund enough value.
        await fundMeContract.write.fund({ value: ethers.parseEther("1")})
        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();

        await viem.assertions.revertWith(
            fundMeContract.write.reFund(),
            "Target is reached.",
        );
    })

    it("window closed, fund target not reached, client didnot fund, reFund failed", async function() {
        // fund not enough value.
        await fundMeContract.write.fund({ value: ethers.parseEther("0.01")})

        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();
        await viem.assertions.revertWith(
            fundMeSecond.write.reFund(),
            "There isnot fund for you.",
        );
    })

    it("window closed, fund target not reached, client funded, reFund success", async function() {
        // fund not enough value.
        await fundMeContract.write.fund({ value: ethers.parseEther("0.01")});
        const clientBalanceBefore = await env.read(fundMe, {functionName: "fundersToAmount", args: [namedAccounts.deployer]});
        await assert.equal(clientBalanceBefore, ethers.parseEther("0.01"));

        // make sure the window is closed.
        await networkHelpers.time.increase(LOCKTIME+5n);
        await networkHelpers.mine();

        await fundMeContract.write.reFund();
        const clientBalanceAfter = await env.read(fundMe, {functionName: "fundersToAmount", args: [namedAccounts.deployer]});
        await assert.equal(clientBalanceAfter, 0);
    })
})